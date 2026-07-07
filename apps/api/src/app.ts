import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { WEB_ORIGINS } from "./env";
import { z } from "zod";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db, players, eloSnapshots, faceitMatchStats, playtimeSnapshots, announcements } from "@4eselo/db";
import type {
  ActivityDay,
  ActivityResponse,
  Announcement,
  AnnouncementsResponse,
  DuoPlayer,
  DuosResponse,
  EloSource,
  EloCurveResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  MatchesResponse,
  MatchSummary,
  MoverEntry,
  MoversResponse,
  PlayerDetail,
  PlayerDuosResponse,
  PlayerStatsResponse,
  PlayerWrappedResponse,
  WrappedResponse,
} from "@4eselo/types";
import { computeAggregate, computeMapStats, rangeCutoff, RANGES } from "./stats";
import { computeDuos, computePlayerDuos, MIN_DUO_MATCHES } from "./social";
import { authRoutes } from "./auth";
import { registerRoutes } from "./register";
import { adminRoutes } from "./admin";
import { computeAwards, computePlayerWrapped } from "./wrapped";
import { loadWrappedInputs } from "./wrappedData";
import { getPresence } from "./presence";

const sourceSchema = z.enum(["faceit", "premier"]).default("faceit");
const uuidSchema = z.string().uuid();

/** `?source=` validé ; null → une 400 a déjà été renvoyée. */
function readSource(c: Context): EloSource | null {
  const parsed = sourceSchema.safeParse(c.req.query("source"));
  return parsed.success ? parsed.data : null;
}

/** `:id` validé UUID ; null → 400 à renvoyer. */
function readPlayerId(c: Context): string | null {
  const parsed = uuidSchema.safeParse(c.req.param("id"));
  return parsed.success ? parsed.data : null;
}

const badRequest = (c: Context, error: string) => c.json({ error }, 400);

async function eloHistory(playerId: string, source: EloSource) {
  const rows = await db
    .select({ elo: eloSnapshots.elo, capturedAt: eloSnapshots.capturedAt })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, playerId), eq(eloSnapshots.source, source)))
    .orderBy(asc(eloSnapshots.capturedAt));
  return rows.map((r) => ({ elo: r.elo, capturedAt: r.capturedAt.toISOString() }));
}

export const app = new Hono();
app.use("*", cors({ origin: WEB_ORIGINS, credentials: true }));

// Une erreur imprévue (DB down…) → 500 structuré, jamais de stack trace au client.
app.onError((err, c) => {
  console.error(`[api] ${c.req.method} ${c.req.path} failed:`, err.message);
  return c.json({ error: "internal error" }, 500);
});

app.route("/", authRoutes);
app.route("/", registerRoutes);
app.route("/", adminRoutes);

app.get("/health", async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ ok: true, db: true });
  } catch {
    return c.json({ ok: false, db: false }, 503);
  }
});

app.get("/presence", async (c) => {
  const rows = await db
    .select({
      id: players.id,
      faceitNickname: players.faceitNickname,
      discordName: players.discordName,
      steamId64: players.steamId64,
      faceitId: players.faceitId,
    })
    .from(players);
  return c.json(await getPresence(rows));
});

const sparklineSchema = z.coerce.number().int().min(1).max(50).optional();

const WINDOW_HOURS = { "24h": 24, "7d": 24 * 7 } as const;
const windowSchema = z.enum(["24h", "7d"]).default("24h");

// NOTE: declared before /leaderboard so Hono matches the static path first.
app.get("/leaderboard/movers", async (c) => {
  const source = readSource(c);
  if (!source) return badRequest(c, "invalid source (faceit|premier)");
  const parsed = windowSchema.safeParse(c.req.query("window"));
  if (!parsed.success) return c.json({ error: "invalid window (24h|7d)" }, 400);
  const window = parsed.data;
  const windowStart = new Date(Date.now() - WINDOW_HOURS[window] * 60 * 60 * 1000);

  const rows = await db.execute<{
    id: string;
    discord_name: string | null;
    faceit_nickname: string | null;
    steam_id64: string | null;
    elo: number | null;
    level: number | null;
    discord_avatar: string | null;
    formation: string | null;
    promo_start: number | null;
    promo_end: number | null;
    baseline_elo: number | null;
  }>(sql`
    select p.id, p.discord_name, p.faceit_nickname, p.steam_id64,
           p.discord_avatar, p.formation, p.promo_start, p.promo_end,
           cur.elo, cur.level, base.elo as baseline_elo
    from players p
    left join lateral (
      select elo, level from elo_snapshots
      where player_id = p.id and source = ${source}
      order by captured_at desc
      limit 1
    ) cur on true
    left join lateral (
      select elo from elo_snapshots
      where player_id = p.id and source = ${source} and captured_at <= ${windowStart.toISOString()}::timestamptz
      order by captured_at desc
      limit 1
    ) base on true
    order by cur.elo desc nulls last, p.faceit_nickname asc
  `);

  const ranked: MoverEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    discordName: r.discord_name,
    faceitNickname: r.faceit_nickname,
    steamId64: r.steam_id64,
    elo: r.elo,
    level: r.level,
    discordAvatar: r.discord_avatar,
    formation: r.formation,
    promoStart: r.promo_start,
    promoEnd: r.promo_end,
    delta: r.elo !== null && r.baseline_elo !== null ? r.elo - r.baseline_elo : null,
  }));
  const movers = [...ranked].sort((a, b) => {
    if (a.delta === null) return b.delta === null ? a.rank - b.rank : 1;
    if (b.delta === null) return -1;
    return b.delta - a.delta || a.rank - b.rank;
  });

  return c.json<MoversResponse>({ source, window, movers });
});

app.get("/leaderboard", async (c) => {
  const source = readSource(c);
  if (!source) return badRequest(c, "invalid source (faceit|premier)");
  const sparkParsed = sparklineSchema.safeParse(c.req.query("sparkline"));
  if (!sparkParsed.success) return c.json({ error: "invalid sparkline (1-50)" }, 400);
  const sparkline = sparkParsed.data;

  const rows = await db.execute<{
    id: string;
    discord_name: string | null;
    faceit_nickname: string | null;
    steam_id64: string | null;
    elo: number | null;
    level: number | null;
    discord_avatar: string | null;
    formation: string | null;
    promo_start: number | null;
    promo_end: number | null;
  }>(sql`
    select p.id, p.discord_name, p.faceit_nickname, p.steam_id64,
           p.discord_avatar, p.formation, p.promo_start, p.promo_end, s.elo, s.level
    from players p
    left join lateral (
      select elo, level from elo_snapshots
      where player_id = p.id and source = ${source}
      order by captured_at desc
      limit 1
    ) s on true
    order by s.elo desc nulls last, p.faceit_nickname asc
  `);

  const leaderboard: LeaderboardEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    discordName: r.discord_name,
    faceitNickname: r.faceit_nickname,
    steamId64: r.steam_id64,
    elo: r.elo,
    level: r.level,
    discordAvatar: r.discord_avatar,
    formation: r.formation,
    promoStart: r.promo_start,
    promoEnd: r.promo_end,
  }));

  if (sparkline) {
    const points = await db.execute<{ player_id: string; points: number[] }>(sql`
      select player_id, array_agg(elo order by captured_at) as points
      from (
        select player_id, elo, captured_at,
               row_number() over (partition by player_id order by captured_at desc) as rn
        from elo_snapshots
        where source = ${source}
      ) t
      where rn <= ${sparkline}
      group by player_id
    `);
    const byPlayer = new Map(points.map((p) => [p.player_id, p.points]));
    for (const entry of leaderboard) entry.sparkline = byPlayer.get(entry.id) ?? [];
  }

  return c.json<LeaderboardResponse>({ source, leaderboard });
});

app.get("/players/:id", async (c) => {
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

  const detail: PlayerDetail = {
    id: player.id,
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
  };

  return c.json(detail);
});

app.get("/players/:id/elo", async (c) => {
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

app.get("/players/:id/matches", async (c) => {
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

const activityDaysSchema = z.coerce.number().int().min(1).max(730).default(365);

/** Nb de matchs par jour UTC depuis la fenêtre. Pôle entier (playerId null) : un match
 *  joué par plusieurs membres compte une fois (distinct matchId). */
async function loadActivity(days: number, playerId: string | null): Promise<ActivityDay[]> {
  const cutoff = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  cutoff.setUTCHours(0, 0, 0, 0); // fenêtre alignée sur des jours UTC pleins, aujourd'hui inclus
  const rows = await db.execute<{ day: string; matches: number }>(sql`
    select to_char(played_at at time zone 'UTC', 'YYYY-MM-DD') as day,
           count(distinct match_id)::int as matches
    from faceit_match_stats
    where played_at >= ${cutoff.toISOString()}::timestamptz
      ${playerId ? sql`and player_id = ${playerId}` : sql``}
    group by 1
    order by 1
  `);
  return rows.map((r) => ({ day: r.day, matches: r.matches }));
}

app.get("/activity", async (c) => {
  const parsed = activityDaysSchema.safeParse(c.req.query("days"));
  if (!parsed.success) return badRequest(c, "invalid days (1-730)");
  return c.json<ActivityResponse>({ days: parsed.data, activity: await loadActivity(parsed.data, null) });
});

app.get("/players/:id/activity", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const parsed = activityDaysSchema.safeParse(c.req.query("days"));
  if (!parsed.success) return badRequest(c, "invalid days (1-730)");
  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);
  return c.json<ActivityResponse>({ days: parsed.data, activity: await loadActivity(parsed.data, id) });
});

/** Membres (id + pseudo affichable) + lignes de matchs — l'entrée du calcul de duos. */
async function loadSocialInputs() {
  const playerRows = await db
    .select({
      id: players.id,
      faceitNickname: players.faceitNickname,
      discordName: players.discordName,
    })
    .from(players);
  const members: DuoPlayer[] = playerRows.map((p) => ({
    id: p.id,
    nickname: p.faceitNickname ?? p.discordName ?? p.id,
  }));
  const matchRows = await db
    .select({
      matchId: faceitMatchStats.matchId,
      playerId: faceitMatchStats.playerId,
      result: faceitMatchStats.result,
    })
    .from(faceitMatchStats);
  return { members, matchRows };
}

app.get("/social/duos", async (c) => {
  const { members, matchRows } = await loadSocialInputs();
  return c.json<DuosResponse>({
    minMatches: MIN_DUO_MATCHES,
    duos: computeDuos(members, matchRows),
  });
});

app.get("/players/:id/duos", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  const { members, matchRows } = await loadSocialInputs();
  return c.json<PlayerDuosResponse>({
    playerId: id,
    minMatches: MIN_DUO_MATCHES,
    duos: computePlayerDuos(id, members, matchRows),
  });
});

const announcementsLimitSchema = z.coerce.number().int().min(1).max(20).default(5);

app.get("/announcements", async (c) => {
  const parsed = announcementsLimitSchema.safeParse(c.req.query("limit"));
  if (!parsed.success) return badRequest(c, "invalid limit (1-20)");

  const rows = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.publishedAt))
    .limit(parsed.data);

  const items: Announcement[] = rows.map((r) => ({
    id: r.id,
    type: r.type as Announcement["type"],
    title: r.title,
    body: r.body,
    linkUrl: r.linkUrl,
    publishedAt: r.publishedAt.toISOString(),
  }));
  return c.json<AnnouncementsResponse>({ announcements: items });
});

const wrappedParamsSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

app.get("/wrapped/:year/:month", async (c) => {
  const parsed = wrappedParamsSchema.safeParse({
    year: c.req.param("year"),
    month: c.req.param("month"),
  });
  if (!parsed.success) return badRequest(c, "invalid year/month");
  const { year, month } = parsed.data;

  const inputs = await loadWrappedInputs(year, month);
  return c.json<WrappedResponse>({ year, month, awards: computeAwards(inputs) });
});

app.get("/wrapped/:year/:month/:playerId", async (c) => {
  const parsed = wrappedParamsSchema.safeParse({
    year: c.req.param("year"),
    month: c.req.param("month"),
  });
  if (!parsed.success) return badRequest(c, "invalid year/month");
  const id = uuidSchema.safeParse(c.req.param("playerId"));
  if (!id.success) return badRequest(c, "invalid player id (uuid)");
  const { year, month } = parsed.data;

  const inputs = await loadWrappedInputs(year, month);
  const wrapped = computePlayerWrapped(id.data, year, month, inputs);
  if (!wrapped) return c.json({ error: "player not found" }, 404);
  return c.json<PlayerWrappedResponse>(wrapped);
});

const rangeSchema = z.enum(RANGES).default("all");

app.get("/players/:id/stats", async (c) => {
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
