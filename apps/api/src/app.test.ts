import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { db, players, eloSnapshots, faceitMatchStats } from "@4eselo/db";
import type {
  PlayerDetail,
  EloCurveResponse,
  LeaderboardResponse,
  MatchesResponse,
  FaceitMatchStats,
  MoversResponse,
  PlayerStatsResponse,
} from "@4eselo/types";
import { app } from "./app";

/** All-zero stats, overridable per test — matches the FaceitMatchStats shape. */
function makeStats(over: Partial<FaceitMatchStats> = {}): FaceitMatchStats {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    kd: 0,
    kr: 0,
    adr: 0,
    damage: 0,
    hsPercent: 0,
    mvps: 0,
    doubleKills: 0,
    tripleKills: 0,
    quadroKills: 0,
    pentaKills: 0,
    clutch1v1Count: 0,
    clutch1v1Wins: 0,
    clutch1v2Count: 0,
    clutch1v2Wins: 0,
    clutchKills: 0,
    entryCount: 0,
    entryWins: 0,
    firstKills: 0,
    utilityDamage: 0,
    utilityCount: 0,
    flashCount: 0,
    enemiesFlashed: 0,
    flashSuccesses: 0,
    sniperKills: 0,
    ...over,
  };
}

// Integration tests hit a real Postgres. Skip cleanly if it isn't reachable
// (e.g. someone ran `pnpm test` without `pnpm db:up`).
async function dbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
const DB_UP = await dbReachable();
const skip = DB_UP ? false : "requires Postgres — run `pnpm db:up`";

let playerId = "";
let moverId = "";
const HOUR = 60 * 60 * 1000;

before(async () => {
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({ discordName: "itest", faceitNickname: "itest_nick", steamId64: "765_itest" })
    .returning({ id: players.id });
  playerId = p!.id;
  const [m] = await db
    .insert(players)
    .values({ discordName: "imover", faceitNickname: "imover_nick", steamId64: "765_imover" })
    .returning({ id: players.id });
  moverId = m!.id;
  await db.insert(eloSnapshots).values([
    // tracked since 3 days: baseline exists for 24h, not for 7d
    {
      playerId: moverId,
      source: "faceit",
      elo: 1500,
      level: 6,
      capturedAt: new Date(Date.now() - 72 * HOUR),
    },
    { playerId: moverId, source: "faceit", elo: 1560, level: 6, capturedAt: new Date(Date.now() - 2 * HOUR) },
  ]);
  await db.insert(eloSnapshots).values([
    { playerId, source: "faceit", elo: 1000, level: 3, capturedAt: new Date("2026-01-01T00:00:00Z") },
    { playerId, source: "faceit", elo: 1100, level: 4, capturedAt: new Date("2026-01-02T00:00:00Z") },
  ]);
  await db.insert(faceitMatchStats).values([
    {
      matchId: "it-m1",
      playerId,
      map: "de_mirage",
      playedAt: new Date("2026-06-01T20:00:00Z"),
      result: 1,
      eloAfter: 1050,
      stats: makeStats({ kills: 20, deaths: 10, adr: 90 }),
    },
    {
      matchId: "it-m2",
      playerId,
      map: "de_dust2",
      playedAt: new Date("2026-06-02T20:00:00Z"),
      result: 0,
      eloAfter: null,
      stats: makeStats({ kills: 10, deaths: 20, adr: 60 }),
    },
    {
      matchId: "it-m3",
      playerId,
      map: "de_mirage",
      playedAt: new Date("2026-06-03T20:00:00Z"),
      result: 1,
      eloAfter: 1080,
      stats: makeStats({ kills: 30, deaths: 15, adr: 110 }),
    },
  ]);
});

after(async () => {
  if (!DB_UP || !playerId) return;
  await db.delete(players).where(eq(players.id, playerId)); // cascade removes snapshots
  await db.delete(players).where(eq(players.id, moverId));
});

test("GET /players/:id returns profile, latest elo and chronological history", { skip }, async () => {
  const res = await app.request(`/players/${playerId}`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as PlayerDetail;

  assert.equal(body.faceitNickname, "itest_nick");
  assert.equal(body.elo, 1100); // latest snapshot wins
  assert.equal(body.level, 4);
  assert.equal(body.history.length, 2);
  assert.equal(body.history[0]!.elo, 1000); // oldest first
  assert.equal(body.history[1]!.elo, 1100);
});

test("GET /players/:id returns 404 for an unknown id", { skip }, async () => {
  const res = await app.request(`/players/00000000-0000-0000-0000-000000000000`);
  assert.equal(res.status, 404);
});

test("GET /players/:id/elo returns the curve points for the source", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/elo?source=faceit`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as EloCurveResponse;
  assert.equal(body.source, "faceit");
  assert.equal(body.points.length, 2);
});

test("GET /players/:id/elo is empty for a source with no snapshots", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/elo?source=premier`);
  const body = await res.json();
  assert.deepEqual(body, { source: "premier", points: [] });
});

test("GET /players/:id/matches lists stored matches, newest first, with total", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/matches`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as MatchesResponse;

  assert.equal(body.total, 3);
  assert.deepEqual(
    body.items.map((m) => m.matchId),
    ["it-m3", "it-m2", "it-m1"],
  );
  const top = body.items[0]!;
  assert.equal(top.map, "de_mirage");
  assert.equal(top.result, 1);
  assert.equal(top.eloAfter, 1080);
  assert.equal(top.stats.kills, 30);
  assert.equal(top.playedAt, "2026-06-03T20:00:00.000Z");
});

test("GET /players/:id/matches paginates with limit/offset (total unchanged)", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/matches?limit=1&offset=1`);
  const body = (await res.json()) as MatchesResponse;

  assert.equal(body.total, 3);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0]!.matchId, "it-m2");
});

test("GET /players/:id/matches returns 404 for an unknown player", { skip }, async () => {
  const res = await app.request(`/players/00000000-0000-0000-0000-000000000000/matches`);
  assert.equal(res.status, 404);
});

test("GET /players/:id/matches rejects an invalid limit with 400", { skip }, async () => {
  for (const q of ["limit=abc", "limit=0", "limit=999", "offset=-1"]) {
    const res = await app.request(`/players/${playerId}/matches?${q}`);
    assert.equal(res.status, 400, q);
  }
});

test("GET /players/:id/stats aggregates stored matches (default range=all)", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/stats`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as PlayerStatsResponse;

  assert.equal(body.range, "all");
  assert.equal(body.overall.matches, 3);
  assert.equal(body.overall.wins, 2);
  assert.equal(body.overall.winRate, 66.7);
  assert.equal(body.overall.kd, 1.3); // 60 kills / 45 deaths
  const mirage = body.maps.find((m) => m.map === "de_mirage");
  assert.ok(mirage);
  assert.equal(mirage.matches, 2);
  assert.equal(mirage.winRate, 100);
});

test("GET /players/:id/stats?range=7d excludes matches older than the window", { skip }, async () => {
  // seeded matches are dated 2026-06-01..03 → outside a 7d window from now
  const res = await app.request(`/players/${playerId}/stats?range=7d`);
  const body = (await res.json()) as PlayerStatsResponse;

  assert.equal(body.range, "7d");
  assert.equal(body.overall.matches, 0);
  assert.equal(body.overall.winRate, 0);
  assert.deepEqual(body.maps, []);
});

test("GET /players/:id/stats rejects an unknown range with 400", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/stats?range=1y`);
  assert.equal(res.status, 400);
});

test("GET /players/:id/stats returns 404 for an unknown player", { skip }, async () => {
  const res = await app.request(`/players/00000000-0000-0000-0000-000000000000/stats`);
  assert.equal(res.status, 404);
});

test("GET /leaderboard/movers?window=24h computes deltas vs the window baseline", { skip }, async () => {
  const res = await app.request(`/leaderboard/movers?window=24h`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as MoversResponse;

  const mover = body.movers.find((m) => m.id === moverId);
  const stable = body.movers.find((m) => m.id === playerId);
  assert.ok(mover && stable);
  assert.equal(mover.delta, 60); // 1560 now vs 1500 before the window
  assert.equal(stable.delta, 0); // old snapshots on both sides → unchanged
  assert.ok(body.movers.indexOf(mover) < body.movers.indexOf(stable)); // biggest gain first
});

test(
  "GET /leaderboard/movers?window=7d gives null delta when not tracked at window start",
  { skip },
  async () => {
    const res = await app.request(`/leaderboard/movers?window=7d`);
    const body = (await res.json()) as MoversResponse;

    const mover = body.movers.find((m) => m.id === moverId);
    const stable = body.movers.find((m) => m.id === playerId);
    assert.equal(mover!.delta, null); // first snapshot is 3 days old
    assert.equal(stable!.delta, 0);
    assert.ok(body.movers.indexOf(mover!) > body.movers.indexOf(stable!)); // nulls last
  },
);

test("GET /leaderboard/movers rejects an unknown window with 400", { skip }, async () => {
  const res = await app.request(`/leaderboard/movers?window=1y`);
  assert.equal(res.status, 400);
});

test("GET /leaderboard?sparkline=N attaches the last N points, oldest first", { skip }, async () => {
  const res = await app.request(`/leaderboard?sparkline=2`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as LeaderboardResponse;

  const mover = body.leaderboard.find((e) => e.id === moverId);
  assert.deepEqual(mover!.sparkline, [1500, 1560]);
  const noSpark = await app.request(`/leaderboard`);
  const plain = (await noSpark.json()) as LeaderboardResponse;
  assert.equal(plain.leaderboard[0]!.sparkline, undefined);
});

test("GET /leaderboard rejects an invalid sparkline with 400", { skip }, async () => {
  for (const q of ["sparkline=0", "sparkline=999", "sparkline=abc"]) {
    const res = await app.request(`/leaderboard?${q}`);
    assert.equal(res.status, 400, q);
  }
});
