import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, inArray } from "drizzle-orm";
import { db, players, eloSnapshots, premierMatchStats } from "@4eselo/db";
import type {
  ConfigResponse,
  EloCurveResponse,
  LeaderboardResponse,
  PremierMatchesResponse,
  PremierMatchStats,
} from "@4eselo/types";
import { app } from "./app";

/** Intégration : les endpoints séparent bien source=premier de source=faceit (B18.5). */

async function dbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
const DB_UP = await dbReachable();
const skip = DB_UP ? false : "requires Postgres - run `pnpm db:up`";

const FACEIT_ID = "fc-premsrc-b1805";
const STEAM_ID = "76561199000000042";
let playerId = "";

before(async () => {
  if (!DB_UP) return;
  await db.delete(players).where(inArray(players.faceitId, [FACEIT_ID])); // cascade → snapshots
  const [p] = await db
    .insert(players)
    .values({ faceitId: FACEIT_ID, faceitNickname: "premsrc", steamId64: STEAM_ID })
    .returning({ id: players.id });
  playerId = p!.id;
  await db.insert(eloSnapshots).values([
    { playerId, source: "faceit", elo: 1000, capturedAt: new Date("2026-07-01T00:00:00Z") },
    { playerId, source: "faceit", elo: 1100, capturedAt: new Date("2026-07-02T00:00:00Z") },
    { playerId, source: "premier", elo: 14000, capturedAt: new Date("2026-07-03T00:00:00Z") },
    { playerId, source: "premier", elo: 14200, capturedAt: new Date("2026-07-04T00:00:00Z") },
  ]);
  const s = (k: number): PremierMatchStats => ({
    kills: k,
    deaths: 10,
    assists: 3,
    kd: k / 10,
    kr: 0.8,
    adr: 85,
    damage: 1700,
    hsPercent: 50,
    rounds: 20,
    mvps: 2,
    doubleKills: 1,
    tripleKills: 0,
    quadroKills: 0,
    pentaKills: 0,
    firstKills: 2,
    firstDeaths: 1,
    utilityDamage: 60,
  });
  await db.insert(premierMatchStats).values([
    {
      shareCode: "CSGO-a",
      playerId,
      map: "de_ancient",
      playedAt: new Date("2026-07-03T00:00:00Z"),
      result: "win",
      ratingAfter: 14000,
      myScore: 13,
      oppScore: 7,
      stats: s(18),
    },
    {
      shareCode: "CSGO-b",
      playerId,
      map: "de_nuke",
      playedAt: new Date("2026-07-04T00:00:00Z"),
      result: "loss",
      ratingAfter: 14200,
      myScore: 9,
      oppScore: 13,
      stats: s(22),
    },
  ]);
});
after(async () => {
  if (DB_UP) await db.delete(players).where(inArray(players.faceitId, [FACEIT_ID]));
});

test("courbe : source=premier ne renvoie que les points premier", { skip }, async () => {
  const prem = (await (
    await app.request(`/players/${playerId}/elo?source=premier`)
  ).json()) as EloCurveResponse;
  assert.equal(prem.source, "premier");
  assert.deepEqual(
    prem.points.map((p) => p.elo),
    [14000, 14200],
  );

  const face = (await (
    await app.request(`/players/${playerId}/elo?source=faceit`)
  ).json()) as EloCurveResponse;
  assert.deepEqual(
    face.points.map((p) => p.elo),
    [1000, 1100],
  );
});

test("classement : source=premier classe sur le rating premier", { skip }, async () => {
  const lb = (await (await app.request("/leaderboard?source=premier")).json()) as LeaderboardResponse;
  assert.equal(lb.source, "premier");
  const mine = lb.leaderboard.find((e) => e.id === playerId);
  assert.ok(mine, "le joueur doit apparaître au classement premier");
  assert.equal(mine!.elo, 14200); // dernier snapshot premier, pas le faceit
});

test("source invalide → 400", { skip }, async () => {
  assert.equal((await app.request(`/players/${playerId}/elo?source=nope`)).status, 400);
});

test(
  "GET /players/:id/premier/matches renvoie les matchs Premier + stats, triés récents d'abord",
  { skip },
  async () => {
    const res = await app.request(`/players/${playerId}/premier/matches`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as PremierMatchesResponse;
    assert.equal(body.total, 2);
    assert.deepEqual(
      body.items.map((m) => m.shareCode),
      ["CSGO-b", "CSGO-a"], // playedAt desc
    );
    assert.equal(body.items[0]!.result, "loss");
    assert.equal(body.items[0]!.stats.kills, 22);
    assert.equal(body.items[0]!.map, "de_nuke");
  },
);

test("premier/matches : joueur inconnu → 404", { skip }, async () => {
  const res = await app.request(`/players/00000000-0000-0000-0000-000000000000/premier/matches`);
  assert.equal(res.status, 404);
});

test("GET /config expose premierEnabled (public, sans auth)", async () => {
  const res = await app.request("/config");
  assert.equal(res.status, 200);
  const body = (await res.json()) as ConfigResponse;
  assert.equal(typeof body.premierEnabled, "boolean");
});
