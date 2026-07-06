import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { WEB_ORIGINS } from "./env";
import { z } from "zod";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db, players, eloSnapshots, faceitMatchStats, playtimeSnapshots } from "@4eselo/db";
import type {
  EloSource,
  EloCurveResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  MatchesResponse,
  MatchSummary,
  MoverEntry,
  MoversResponse,
  PlayerDetail,
  PlayerStatsResponse,
} from "@4eselo/types";
import { computeAggregate, computeMapStats, rangeCutoff, RANGES } from "./stats";
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
app.use("*", cors({ origin: WEB_ORIGINS }));

// Une erreur imprévue (DB down…) → 500 structuré, jamais de stack trace au client.
app.onError((err, c) => {
  console.error(`[api] ${c.req.method} ${c.req.path} failed:`, err.message);
  return c.json({ error: "internal error" }, 500);
});

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
    baseline_elo: number | null;
  }>(sql`
    select p.id, p.discord_name, p.faceit_nickname, p.steam_id64,
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
  }>(sql`
    select p.id, p.discord_name, p.faceit_nickname, p.steam_id64, s.elo, s.level
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
