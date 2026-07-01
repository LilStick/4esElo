import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, players, eloSnapshots } from "@4eselo/db";
import type {
  EloSource,
  EloCurveResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  PlayerDetail,
} from "@4eselo/types";

const SOURCES: EloSource[] = ["faceit", "premier"];

function parseSource(raw: string | undefined): EloSource {
  return SOURCES.includes(raw as EloSource) ? (raw as EloSource) : "faceit";
}

async function eloHistory(playerId: string, source: EloSource) {
  const rows = await db
    .select({ elo: eloSnapshots.elo, capturedAt: eloSnapshots.capturedAt })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, playerId), eq(eloSnapshots.source, source)))
    .orderBy(asc(eloSnapshots.capturedAt));
  return rows.map((r) => ({ elo: r.elo, capturedAt: r.capturedAt.toISOString() }));
}

export const app = new Hono();
app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true }));

app.get("/leaderboard", async (c) => {
  const source = parseSource(c.req.query("source"));

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

  return c.json<LeaderboardResponse>({ source, leaderboard });
});

app.get("/players/:id", async (c) => {
  const id = c.req.param("id");
  const source = parseSource(c.req.query("source"));

  const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  const [latest] = await db
    .select({ elo: eloSnapshots.elo, level: eloSnapshots.level })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, id), eq(eloSnapshots.source, source)))
    .orderBy(desc(eloSnapshots.capturedAt))
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
  };

  return c.json(detail);
});

app.get("/players/:id/elo", async (c) => {
  const id = c.req.param("id");
  const source = parseSource(c.req.query("source"));
  return c.json<EloCurveResponse>({ source, points: await eloHistory(id, source) });
});
