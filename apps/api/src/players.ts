import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  players,
  eloSnapshots,
  faceitMatchStats,
  premierMatchStats,
  playtimeSnapshots,
  achievements,
} from "@4eselo/db";
import type {
  EloSource,
  EloCurveResponse,
  MatchSummary,
  MatchesResponse,
  PremierMatchesResponse,
  PlayerDetail,
  PlayerStatsResponse,
  PlayerBenchmarkResponse,
  AchievementState,
  AchievementsResponse,
  RoastResponse,
} from "@4eselo/types";
import { computeStreak } from "./streaks";
import { computeBadges, computeBadgeTiers, type BadgeMatch } from "./badges";
import { evaluateAchievements, bestEloGainWithin } from "./achievements";
import { profileRoast, forecastElo, type RoastProfileInput } from "./roast";
import { computeAggregate, computeMapStats, rangeCutoff, RANGES, type MatchForStats } from "./stats";
import { computeBenchmark, type PlayerAggregate } from "./benchmark";
import { readSource, readPlayerId, badRequest } from "./http";
import { effectiveEloDelta } from "./eloDelta";

export const playersRoutes = new Hono();

async function eloHistory(playerId: string, source: EloSource) {
  const rows = await db
    .select({ elo: eloSnapshots.elo, capturedAt: eloSnapshots.capturedAt })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, playerId), eq(eloSnapshots.source, source)))
    .orderBy(asc(eloSnapshots.capturedAt));
  return rows.map((r) => ({ elo: r.elo, capturedAt: r.capturedAt.toISOString() }));
}

playersRoutes.get("/players/:id", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const source = readSource(c);
  if (!source) return badRequest(c, "invalid source (faceit|premier)");

  const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  const [latest] = await db
    .select({ elo: eloSnapshots.elo, level: eloSnapshots.level })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, id), eq(eloSnapshots.source, source)))
    .orderBy(desc(eloSnapshots.capturedAt))
    .limit(1);

  const [lastPlaytime] = await db
    .select({ minutes: playtimeSnapshots.minutesForever })
    .from(playtimeSnapshots)
    .where(eq(playtimeSnapshots.playerId, id))
    .orderBy(desc(playtimeSnapshots.capturedAt))
    .limit(1);

  const matchRows = await db
    .select({
      result: faceitMatchStats.result,
      playedAt: faceitMatchStats.playedAt,
      stats: faceitMatchStats.stats,
    })
    .from(faceitMatchStats)
    .where(eq(faceitMatchStats.playerId, id))
    .orderBy(desc(faceitMatchStats.playedAt));

  const badgeMatches: BadgeMatch[] = matchRows.map((r) => ({
    playedAt: r.playedAt,
    result: r.result,
    hsPercent: r.stats.hsPercent,
    entryCount: r.stats.entryCount,
    entryWins: r.stats.entryWins,
    clutchCount: r.stats.clutch1v1Count + r.stats.clutch1v2Count,
    clutchWins: r.stats.clutch1v1Wins + r.stats.clutch1v2Wins,
  }));

  const detail: PlayerDetail = {
    id: player.id,
    discordId: player.discordId,
    discordName: player.discordName,
    faceitNickname: player.faceitNickname,
    steamId64: player.steamId64,
    elo: latest?.elo ?? null,
    level: latest?.level ?? null,
    discordAvatar: player.discordAvatar,
    formation: player.formation,
    promoStart: player.promoStart,
    promoEnd: player.promoEnd,
    createdAt: player.createdAt.toISOString(),
    history: await eloHistory(id, source),
    playtimePrivate: lastPlaytime ? lastPlaytime.minutes === null : null,
    streak: computeStreak(matchRows.map((r) => r.result)),
    badges: computeBadges(badgeMatches),
    // Fenêtre 30j (B5.13) : le profil montre la forme récente.
    badgeTiers: computeBadgeTiers(
      badgeMatches.filter((m) => m.playedAt.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000),
      "month",
    ),
  };

  return c.json(detail);
});

playersRoutes.get("/players/:id/elo", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const source = readSource(c);
  if (!source) return badRequest(c, "invalid source (faceit|premier)");
  return c.json<EloCurveResponse>({ source, points: await eloHistory(id, source) });
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

playersRoutes.get("/players/:id/matches", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const parsed = paginationSchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: "invalid pagination" }, 400);
  const { limit, offset } = parsed.data;

  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(faceitMatchStats)
    .where(eq(faceitMatchStats.playerId, id));

  const rows = await db
    .select({
      matchId: faceitMatchStats.matchId,
      map: faceitMatchStats.map,
      playedAt: faceitMatchStats.playedAt,
      result: faceitMatchStats.result,
      eloAfter: faceitMatchStats.eloAfter,
      eloDelta: faceitMatchStats.eloDelta,
      stats: faceitMatchStats.stats,
      // ±ELO dérivé quand elo_delta est vide (B2.12). Window sur tout l'historique
      // (WHERE filtre avant), donc correct malgré limit/offset.
      prevEloAfter: sql<
        number | null
      >`lag(${faceitMatchStats.eloAfter}) over (partition by ${faceitMatchStats.playerId} order by ${faceitMatchStats.playedAt} asc, ${faceitMatchStats.matchId} asc)`,
    })
    .from(faceitMatchStats)
    .where(eq(faceitMatchStats.playerId, id))
    .orderBy(desc(faceitMatchStats.playedAt))
    .limit(limit)
    .offset(offset);

  const items: MatchSummary[] = rows.map((r) => ({
    matchId: r.matchId,
    map: r.map,
    playedAt: r.playedAt.toISOString(),
    result: r.result,
    eloAfter: r.eloAfter,
    eloDelta: effectiveEloDelta(r.eloDelta, r.eloAfter, r.prevEloAfter),
    stats: r.stats,
  }));

  return c.json<MatchesResponse>({ items, total: counted?.total ?? 0 });
});

/** Matchs Premier + stats par match (B18.14). Table dédiée, source démo. */
playersRoutes.get("/players/:id/premier/matches", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const parsed = paginationSchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json({ error: "invalid pagination" }, 400);
  const { limit, offset } = parsed.data;

  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(premierMatchStats)
    .where(eq(premierMatchStats.playerId, id));

  const rows = await db
    .select({
      shareCode: premierMatchStats.shareCode,
      map: premierMatchStats.map,
      playedAt: premierMatchStats.playedAt,
      result: premierMatchStats.result,
      ratingAfter: premierMatchStats.ratingAfter,
      myScore: premierMatchStats.myScore,
      oppScore: premierMatchStats.oppScore,
      stats: premierMatchStats.stats,
    })
    .from(premierMatchStats)
    .where(eq(premierMatchStats.playerId, id))
    .orderBy(desc(premierMatchStats.playedAt))
    .limit(limit)
    .offset(offset);

  return c.json<PremierMatchesResponse>({
    items: rows.map((r) => ({
      shareCode: r.shareCode,
      map: r.map,
      playedAt: r.playedAt.toISOString(),
      result: r.result,
      ratingAfter: r.ratingAfter,
      myScore: r.myScore,
      oppScore: r.oppScore,
      stats: r.stats,
    })),
    total: counted?.total ?? 0,
  });
});

const rangeSchema = z.enum(RANGES).default("all");

playersRoutes.get("/players/:id/stats", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const parsed = rangeSchema.safeParse(c.req.query("range"));
  if (!parsed.success) return c.json({ error: "invalid range (7d|30d|3m|all)" }, 400);
  const range = parsed.data;

  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  const cutoff = rangeCutoff(range, new Date());
  const rows = await db
    .select({
      map: faceitMatchStats.map,
      result: faceitMatchStats.result,
      stats: faceitMatchStats.stats,
    })
    .from(faceitMatchStats)
    .where(
      cutoff
        ? and(eq(faceitMatchStats.playerId, id), gte(faceitMatchStats.playedAt, cutoff))
        : eq(faceitMatchStats.playerId, id),
    );

  return c.json<PlayerStatsResponse>({
    range,
    overall: computeAggregate(range, rows),
    maps: computeMapStats(rows),
  });
});

// Percentile intra-asso par stat clé (B5.11), même fenêtre que /stats.
playersRoutes.get("/players/:id/benchmark", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const parsed = rangeSchema.safeParse(c.req.query("range"));
  if (!parsed.success) return c.json({ error: "invalid range (7d|30d|3m|all)" }, 400);
  const range = parsed.data;

  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  // Tous membres confondus : le référentiel du percentile, c'est l'asso.
  const cutoff = rangeCutoff(range, new Date());
  const base = db
    .select({
      playerId: faceitMatchStats.playerId,
      map: faceitMatchStats.map,
      result: faceitMatchStats.result,
      stats: faceitMatchStats.stats,
    })
    .from(faceitMatchStats);
  const rows = cutoff ? await base.where(gte(faceitMatchStats.playedAt, cutoff)) : await base;

  const byPlayer = new Map<string, MatchForStats[]>();
  for (const r of rows) {
    const list = byPlayer.get(r.playerId) ?? [];
    list.push({ map: r.map, result: r.result, stats: r.stats });
    byPlayer.set(r.playerId, list);
  }

  const allPlayers = await db.select({ id: players.id }).from(players);
  const aggregates: PlayerAggregate[] = allPlayers.map((p) => ({
    playerId: p.id,
    aggregate: computeAggregate(range, byPlayer.get(p.id) ?? []),
  }));

  const benchmark = computeBenchmark(range, id, aggregates);
  if (!benchmark) return c.json({ error: "player not found" }, 404);
  return c.json<PlayerBenchmarkResponse>(benchmark);
});

playersRoutes.get("/players/:id/achievements", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  const [agg] = await db
    .select({
      matches: sql<number>`count(*)::int`,
      wins: sql<number>`coalesce(sum(${faceitMatchStats.result}), 0)::int`,
      kills: sql<number>`coalesce(sum((${faceitMatchStats.stats}->>'kills')::int), 0)::int`,
      aces: sql<number>`coalesce(sum((${faceitMatchStats.stats}->>'pentaKills')::int), 0)::int`,
      clutchWins: sql<number>`coalesce(sum((${faceitMatchStats.stats}->>'clutch1v1Wins')::int + (${faceitMatchStats.stats}->>'clutch1v2Wins')::int), 0)::int`,
      entryWins: sql<number>`coalesce(sum((${faceitMatchStats.stats}->>'entryWins')::int), 0)::int`,
      mvps: sql<number>`coalesce(sum((${faceitMatchStats.stats}->>'mvps')::int), 0)::int`,
      sniperKills: sql<number>`coalesce(sum((${faceitMatchStats.stats}->>'sniperKills')::int), 0)::int`,
    })
    .from(faceitMatchStats)
    .where(eq(faceitMatchStats.playerId, id));

  const snaps = await db
    .select({ elo: eloSnapshots.elo, capturedAt: eloSnapshots.capturedAt })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, id), eq(eloSnapshots.source, "faceit")))
    .orderBy(asc(eloSnapshots.capturedAt));
  const maxElo = snaps.reduce((m, s) => Math.max(m, s.elo), 0);

  const evaluated = evaluateAchievements({
    matches: agg?.matches ?? 0,
    wins: agg?.wins ?? 0,
    kills: agg?.kills ?? 0,
    aces: agg?.aces ?? 0,
    clutchWins: agg?.clutchWins ?? 0,
    entryWins: agg?.entryWins ?? 0,
    mvps: agg?.mvps ?? 0,
    sniperKills: agg?.sniperKills ?? 0,
    maxElo,
    bestEloGain30d: bestEloGainWithin(snaps, 30 * 24 * 60 * 60 * 1000),
  });

  // Persiste les nouveaux déblocages (date figée à la 1re détection) ; idempotent.
  const unlocked = evaluated.filter((e) => e.unlocked);
  if (unlocked.length > 0) {
    await db
      .insert(achievements)
      .values(unlocked.map((e) => ({ playerId: id, achievementId: e.def.id })))
      .onConflictDoNothing();
  }
  const persisted = await db
    .select({ achievementId: achievements.achievementId, unlockedAt: achievements.unlockedAt })
    .from(achievements)
    .where(eq(achievements.playerId, id));
  const dateById = new Map(persisted.map((p) => [p.achievementId, p.unlockedAt.toISOString()]));

  const states: AchievementState[] = evaluated.map((e) => ({
    ...e.def,
    current: e.current,
    unlocked: e.unlocked,
    unlockedAt: e.unlocked ? (dateById.get(e.def.id) ?? null) : null,
  }));
  return c.json<AchievementsResponse>({ achievements: states });
});

playersRoutes.get("/players/:id/roast", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  const rows = await db
    .select({
      map: faceitMatchStats.map,
      result: faceitMatchStats.result,
      stats: faceitMatchStats.stats,
    })
    .from(faceitMatchStats)
    .where(eq(faceitMatchStats.playerId, id))
    .orderBy(desc(faceitMatchStats.playedAt));

  const n = rows.length;
  let kills = 0;
  let deaths = 0;
  let hsSum = 0;
  let adrSum = 0;
  let cW = 0;
  let cA = 0;
  let eW = 0;
  let eA = 0;
  for (const m of rows) {
    kills += m.stats.kills;
    deaths += m.stats.deaths;
    hsSum += m.stats.hsPercent;
    adrSum += m.stats.adr;
    cW += m.stats.clutch1v1Wins + m.stats.clutch1v2Wins;
    cA += m.stats.clutch1v1Count + m.stats.clutch1v2Count;
    eW += m.stats.entryWins;
    eA += m.stats.entryCount;
  }
  const streak = computeStreak(rows.map((m) => m.result));
  const allMaps = computeMapStats(rows.map((m) => ({ map: m.map, result: m.result, stats: m.stats })));
  const topMap = allMaps[0]
    ? { map: allMaps[0].map, winRate: allMaps[0].winRate, matches: allMaps[0].matches }
    : null;
  const eligibleMaps = allMaps.filter((mp) => mp.matches >= 5);
  const worstMap = eligibleMaps.length
    ? eligibleMaps.reduce((w, mp) => (mp.winRate < w.winRate ? mp : w))
    : null;

  const snaps = await db
    .select({ elo: eloSnapshots.elo, capturedAt: eloSnapshots.capturedAt })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, id), eq(eloSnapshots.source, "faceit")))
    .orderBy(asc(eloSnapshots.capturedAt));
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent30 = snaps.filter((s) => s.capturedAt.getTime() >= cutoff);
  const eloDelta30d = recent30.length >= 2 ? recent30[recent30.length - 1]!.elo - recent30[0]!.elo : null;

  const input: RoastProfileInput = {
    matches: n,
    avgHs: n ? hsSum / n : 0,
    kd: deaths > 0 ? kills / deaths : kills,
    adr: n ? adrSum / n : 0,
    clutchAttempts: cA,
    clutchWinRate: cA > 0 ? (cW / cA) * 100 : 0,
    entryAttempts: eA,
    entrySuccessRate: eA > 0 ? (eW / eA) * 100 : 0,
    currentWinStreak: streak.current?.type === "win" ? streak.current.length : 0,
    eloDelta30d,
    worstMap: worstMap ? { map: worstMap.map, winRate: worstMap.winRate, matches: worstMap.matches } : null,
    topMap,
  };

  return c.json<RoastResponse>({ lines: profileRoast(input), forecast: forecastElo(snaps, new Date()) });
});
