import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { db, players, eloSnapshots } from "@4eselo/db";
import type { PlayerDetail, EloCurveResponse } from "@4eselo/types";
import { app } from "./app";

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

before(async () => {
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({ discordName: "itest", faceitNickname: "itest_nick", steamId64: "765_itest" })
    .returning({ id: players.id });
  playerId = p!.id;
  await db.insert(eloSnapshots).values([
    { playerId, source: "faceit", elo: 1000, level: 3, capturedAt: new Date("2026-01-01T00:00:00Z") },
    { playerId, source: "faceit", elo: 1100, level: 4, capturedAt: new Date("2026-01-02T00:00:00Z") },
  ]);
});

after(async () => {
  if (!DB_UP || !playerId) return;
  await db.delete(players).where(eq(players.id, playerId)); // cascade removes snapshots
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
