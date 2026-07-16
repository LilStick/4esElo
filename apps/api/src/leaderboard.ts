import { Hono } from "hono";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@4eselo/db";
import type {
  LeaderboardEntry,
  LeaderboardResponse,
  MapsLeaderboardResponse,
  MoverEntry,
  MoversResponse,
  OvertakesResponse,
} from "@4eselo/types";
import { computeOvertakes } from "./streaks";
import { computeBadges, computeBadgeTiers, type BadgeMatch } from "./badges";
import {
  computeMapLeaderboard,
  MIN_MAP_MATCHES,
  type MapLeaderboardPlayer,
  type MapLeaderboardRow,
} from "./stats";
import { readSource, badRequest } from "./http";

export const leaderboardRoutes = new Hono();

const sparklineSchema = z.coerce.number().int().min(1).max(50).optional();
const WINDOW_HOURS = { "24h": 24, "7d": 24 * 7 } as const;
const windowSchema = z.enum(["24h", "7d"]).default("24h");

// Hono : /movers et /overtakes AVANT /leaderboard (le chemin statique doit matcher en premier).
leaderboardRoutes.get("/leaderboard/movers", async (c) => {
  const source = readSource(c);
  if (!source) return badRequest(c, "invalid source (faceit|premier)");
  const parsed = windowSchema.safeParse(c.req.query("window"));
  if (!parsed.success) return c.json({ error: "invalid window (24h|7d)" }, 400);
  const window = parsed.data;
  const windowStart = new Date(Date.now() - WINDOW_HOURS[window] * 60 * 60 * 1000);

  const rows = await db.execute<{
    id: string;
    discord_id: string | null;
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
    select p.id, p.discord_id, p.discord_name, p.faceit_nickname, p.steam_id64,
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
    discordId: r.discord_id,
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

leaderboardRoutes.get("/leaderboard/overtakes", async (c) => {
  const source = readSource(c);
  if (!source) return badRequest(c, "invalid source (faceit|premier)");
  const parsed = windowSchema.safeParse(c.req.query("window"));
  if (!parsed.success) return c.json({ error: "invalid window (24h|7d)" }, 400);
  const window = parsed.data;
  const windowStart = new Date(Date.now() - WINDOW_HOURS[window] * 60 * 60 * 1000);

  const rows = await db.execute<{
    id: string;
    discord_id: string | null;
    discord_name: string | null;
    faceit_nickname: string | null;
    discord_avatar: string | null;
    elo: number | null;
    baseline_elo: number | null;
  }>(sql`
    select p.id, p.discord_id, p.discord_name, p.faceit_nickname, p.discord_avatar,
           cur.elo, base.elo as baseline_elo
    from players p
    left join lateral (
      select elo from elo_snapshots
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
  `);

  const overtakes = computeOvertakes(
    rows.map((r) => ({
      id: r.id,
      discordId: r.discord_id,
      faceitNickname: r.faceit_nickname,
      discordName: r.discord_name,
      discordAvatar: r.discord_avatar,
      elo: r.elo,
      baselineElo: r.baseline_elo,
    })),
  );

  return c.json<OvertakesResponse>({ source, window, overtakes });
});

// Chemin statique avant /leaderboard (cf. movers/overtakes).
leaderboardRoutes.get("/leaderboard/maps", async (c) => {
  const playerRows = await db.execute<{
    id: string;
    faceit_nickname: string | null;
    discord_name: string | null;
    discord_id: string | null;
    discord_avatar: string | null;
  }>(sql`select id, faceit_nickname, discord_name, discord_id, discord_avatar from players`);
  const matchRows = await db.execute<{
    player_id: string;
    map: string;
    result: number;
    kills: number;
    deaths: number;
  }>(sql`
    select player_id, map, result,
           coalesce((stats->>'kills')::int, 0) as kills,
           coalesce((stats->>'deaths')::int, 0) as deaths
    from faceit_match_stats
  `);

  const players: MapLeaderboardPlayer[] = playerRows.map((p) => ({
    id: p.id,
    nickname: p.faceit_nickname ?? p.discord_name ?? p.id,
    discordId: p.discord_id,
    discordAvatar: p.discord_avatar,
  }));
  const rows: MapLeaderboardRow[] = matchRows.map((r) => ({
    playerId: r.player_id,
    map: r.map,
    result: r.result,
    kills: r.kills,
    deaths: r.deaths,
  }));

  return c.json<MapsLeaderboardResponse>({
    minMatches: MIN_MAP_MATCHES,
    maps: computeMapLeaderboard(players, rows),
  });
});

leaderboardRoutes.get("/leaderboard", async (c) => {
  const source = readSource(c);
  if (!source) return badRequest(c, "invalid source (faceit|premier)");
  const sparkParsed = sparklineSchema.safeParse(c.req.query("sparkline"));
  if (!sparkParsed.success) return c.json({ error: "invalid sparkline (1-50)" }, 400);
  const sparkline = sparkParsed.data;

  const rows = await db.execute<{
    id: string;
    discord_id: string | null;
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
    select p.id, p.discord_id, p.discord_name, p.faceit_nickname, p.steam_id64,
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
    discordId: r.discord_id,
    discordName: r.discord_name,
    faceitNickname: r.faceit_nickname,
    steamId64: r.steam_id64,
    elo: r.elo,
    level: r.level,
    discordAvatar: r.discord_avatar,
    formation: r.formation,
    promoStart: r.promo_start,
    promoEnd: r.promo_end,
    badges: [],
    badgeTiers: [],
  }));

  // Badges (B5.8) : que les champs scalaires du JSONB (pas de payload lourd), agrégés en mémoire.
  const badgeRows = await db.execute<{
    player_id: string;
    played_at: string; // SQL brut → string ISO, pas un Date typé Drizzle
    result: number;
    hs: number;
    entry_count: number;
    entry_wins: number;
    clutch_count: number;
    clutch_wins: number;
  }>(sql`
    select player_id, played_at, result,
           coalesce((stats->>'hsPercent')::float, 0) as hs,
           coalesce((stats->>'entryCount')::int, 0) as entry_count,
           coalesce((stats->>'entryWins')::int, 0) as entry_wins,
           coalesce((stats->>'clutch1v1Count')::int, 0) + coalesce((stats->>'clutch1v2Count')::int, 0) as clutch_count,
           coalesce((stats->>'clutch1v1Wins')::int, 0) + coalesce((stats->>'clutch1v2Wins')::int, 0) as clutch_wins
    from faceit_match_stats
  `);
  const matchesByPlayer = new Map<string, BadgeMatch[]>();
  for (const r of badgeRows) {
    const list = matchesByPlayer.get(r.player_id) ?? [];
    list.push({
      playedAt: new Date(r.played_at),
      result: r.result,
      hsPercent: r.hs,
      entryCount: r.entry_count,
      entryWins: r.entry_wins,
      clutchCount: r.clutch_count,
      clutchWins: r.clutch_wins,
    });
    matchesByPlayer.set(r.player_id, list);
  }
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  for (const entry of leaderboard) {
    const all = matchesByPlayer.get(entry.id) ?? [];
    entry.badges = computeBadges(all);
    // Fenêtre 24h (B5.13) : le classement montre le « chaud aujourd'hui ».
    entry.badgeTiers = computeBadgeTiers(
      all.filter((m) => m.playedAt.getTime() >= since24h),
      "today",
    );
  }

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
