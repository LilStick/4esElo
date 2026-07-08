import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db, players, eloSnapshots, faceitMatchStats, playtimeSnapshots } from "@4eselo/db";
import type {
  EloSource,
  EloCurveResponse,
  MatchSummary,
  MatchesResponse,
  PlayerDetail,
  PlayerStatsResponse,
} from "@4eselo/types";
import { computeStreak } from "./streaks";
import { computeBadges, type BadgeMatch } from "./badges";
import { computeAggregate, computeMapStats, rangeCutoff, RANGES } from "./stats";
import { readSource, readPlayerId, badRequest } from "./http";

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
    .select()
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
    eloDelta: r.eloDelta,
    stats: r.stats,
  }));

  return c.json<MatchesResponse>({ items, total: counted?.total ?? 0 });
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
