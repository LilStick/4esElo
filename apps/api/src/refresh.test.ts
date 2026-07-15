import "./env";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql, eq, desc } from "drizzle-orm";
import { db, players, eloSnapshots } from "@4eselo/db";
import type { FaceitPlayer } from "@4eselo/faceit";
import type { RefreshEloResponse } from "@4eselo/types";
import { app } from "./app";
import { refreshDeps, resetRefreshCooldown } from "./refresh";

/** Intégration refresh ELO à la demande (B16.6) - Faceit mocké, vraie DB. */

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

let pid = "";
let currentElo = 1500; // ce que le faux Faceit renvoie (mutable par test)

const fakeFaceit = {
  async getPlayerById(): Promise<FaceitPlayer> {
    return {
      playerId: "f-iref",
      nickname: "iref",
      avatar: null,
      country: "fr",
      cs2: { elo: currentElo, skillLevel: 8, steamId64: "765_iref" },
    };
  },
};

const saved = refreshDeps.faceit;

before(async () => {
  refreshDeps.faceit = fakeFaceit;
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({ discordName: "iref", faceitNickname: "iref", faceitId: "f-iref", steamId64: "765_iref" })
    .returning({ id: players.id });
  pid = p!.id;
  await db.insert(eloSnapshots).values({ playerId: pid, source: "faceit", elo: 1400, level: 7 }); // baseline
});

beforeEach(() => {
  resetRefreshCooldown();
  currentElo = 1500;
});

after(async () => {
  refreshDeps.faceit = saved;
  if (DB_UP && pid) await db.delete(players).where(eq(players.id, pid)); // cascade → snapshots
});

const post = (id: string) => app.request(`/players/${id}/refresh`, { method: "POST" });
const snapCount = async () =>
  (
    await db
      .select({ c: sql<number>`count(*)::int` })
      .from(eloSnapshots)
      .where(eq(eloSnapshots.playerId, pid))
  )[0]!.c;

test("refresh : resync et insère un snapshot si l'ELO a changé", { skip }, async () => {
  currentElo = 1500; // baseline 1400 → changement
  const res = await post(pid);
  assert.equal(res.status, 200);
  const body = (await res.json()) as RefreshEloResponse;
  assert.equal(body.elo, 1500);
  assert.equal(body.changed, true);
  const [latest] = await db
    .select({ elo: eloSnapshots.elo })
    .from(eloSnapshots)
    .where(eq(eloSnapshots.playerId, pid))
    .orderBy(desc(eloSnapshots.capturedAt))
    .limit(1);
  assert.equal(latest!.elo, 1500);
});

test("refresh : ELO inchangé → changed:false, aucun nouveau snapshot", { skip }, async () => {
  await db.insert(eloSnapshots).values({ playerId: pid, source: "faceit", elo: 1500, level: 8 });
  const before = await snapCount();
  currentElo = 1500; // == dernier snapshot
  const body = (await (await post(pid)).json()) as RefreshEloResponse;
  assert.equal(body.changed, false);
  assert.equal(await snapCount(), before); // pas d'insert
});

test("refresh : 2e appel dans le cooldown → 429", { skip }, async () => {
  assert.equal((await post(pid)).status, 200);
  assert.equal((await post(pid)).status, 429); // pas de reset entre les deux
});

test("refresh : joueur inconnu → 404, id invalide → 400", { skip }, async () => {
  assert.equal((await post("00000000-0000-0000-0000-000000000000")).status, 404);
  assert.equal((await post("not-a-uuid")).status, 400);
});

test("refresh : Faceit non configuré → 503", { skip }, async () => {
  refreshDeps.faceit = null;
  assert.equal((await post(pid)).status, 503);
  refreshDeps.faceit = fakeFaceit;
});
