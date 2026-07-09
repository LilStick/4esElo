import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { db, players, faceitMatchStats } from "@4eselo/db";
import type { FaceitMatchStats, MatchesResponse, RecentMatchesResponse } from "@4eselo/types";
import { app } from "./app";
import { effectiveEloDelta } from "./eloDelta";

// Intégration = vraie DB, skip propre si Postgres absent (calculé avant tout test()).
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

let pid = "";

function zeroStats(over: Partial<FaceitMatchStats> = {}): FaceitMatchStats {
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

before(async () => {
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({ discordName: "delta_itest", faceitNickname: "delta_nick" })
    .returning({ id: players.id });
  pid = p!.id;
  // 3 matchs consécutifs. eloAfter posé partout ; eloDelta null sauf mC (backfill).
  await db.insert(faceitMatchStats).values([
    {
      matchId: "delta-mA",
      playerId: pid,
      map: "de_mirage",
      playedAt: new Date("2026-06-01T20:00:00Z"),
      result: 1,
      eloAfter: 1500,
      eloDelta: null,
      stats: zeroStats(),
    },
    {
      matchId: "delta-mB",
      playerId: pid,
      map: "de_dust2",
      playedAt: new Date("2026-06-02T20:00:00Z"),
      result: 1,
      eloAfter: 1560,
      eloDelta: null,
      stats: zeroStats(),
    },
    {
      matchId: "delta-mC",
      playerId: pid,
      map: "de_inferno",
      playedAt: new Date("2026-06-03T20:00:00Z"),
      result: 0,
      eloAfter: 1600,
      eloDelta: 999,
      stats: zeroStats(),
    },
  ]);
});

after(async () => {
  if (!DB_UP || !pid) return;
  await db.delete(players).where(eq(players.id, pid)); // cascade → matchs
});

// --- Unitaires (purs) ---

test("effectiveEloDelta : colonne backfill prioritaire", () => {
  assert.equal(effectiveEloDelta(40, 1600, 1560), 40);
});
test("effectiveEloDelta : dérive de eloAfter − eloAfter précédent quand colonne null", () => {
  assert.equal(effectiveEloDelta(null, 1560, 1500), 60);
  assert.equal(effectiveEloDelta(null, 1480, 1500), -20);
});
test("effectiveEloDelta : null si eloAfter ou son prédécesseur manque", () => {
  assert.equal(effectiveEloDelta(null, 1560, null), null);
  assert.equal(effectiveEloDelta(null, null, 1500), null);
  assert.equal(effectiveEloDelta(null, null, null), null);
});

// --- Non-régression du bug (intégration) ---

test(
  "REGRESSION /players/:id/matches : ±ELO dérivé des eloAfter, colonne prioritaire",
  { skip },
  async () => {
    const res = await app.request(`/players/${pid}/matches?limit=50`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as MatchesResponse;
    const byId = new Map(body.items.map((m) => [m.matchId, m.eloDelta]));
    // mC : colonne backfill (999) prioritaire.
    assert.equal(byId.get("delta-mC"), 999);
    // mB : colonne null → dérivé 1560 − 1500 = 60 (le bug : renvoyait null → « — »).
    assert.equal(byId.get("delta-mB"), 60);
    // mA : pas de prédécesseur → null propre.
    assert.equal(byId.get("delta-mA"), null);
  },
);

test("REGRESSION /matches/recent : ±ELO dérivé pour le match récent", { skip }, async () => {
  const res = await app.request(`/matches/recent?limit=100`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as RecentMatchesResponse;
  const byId = new Map(body.items.map((m) => [m.matchId, m.eloDelta]));
  assert.equal(byId.get("delta-mC"), 999);
  assert.equal(byId.get("delta-mB"), 60); // dérivé
  assert.equal(byId.get("delta-mA"), null);
});
