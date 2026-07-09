import "./dotenvRoot";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq, and } from "drizzle-orm";
import { db, players, faceitMatchStats } from "@4eselo/db";
import type { FaceitMatchStats } from "@4eselo/types";
import { dbMatchStatsStore } from "./store";

// Intégration = vraie DB, skip propre si Postgres absent (calculé avant tout test).
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

function zeroStats(): FaceitMatchStats {
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
  };
}

async function eloAfterOf(matchId: string): Promise<number | null> {
  const [row] = await db
    .select({ eloAfter: faceitMatchStats.eloAfter })
    .from(faceitMatchStats)
    .where(and(eq(faceitMatchStats.playerId, pid), eq(faceitMatchStats.matchId, matchId)))
    .limit(1);
  return row?.eloAfter ?? null;
}

before(async () => {
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({ discordName: "store_itest", faceitNickname: "store_nick" })
    .returning({ id: players.id });
  pid = p!.id;
  // Match ancien avec elo_after connu ; match le plus récent SANS elo_after
  // (le cas du bug : ingéré à un tick, l'ELO n'a bougé qu'ensuite).
  await db.insert(faceitMatchStats).values([
    {
      matchId: "b213-old",
      playerId: pid,
      map: "de_mirage",
      playedAt: new Date("2026-06-01T20:00:00Z"),
      result: 1,
      eloAfter: 1500,
      stats: zeroStats(),
    },
    {
      matchId: "b213-new",
      playerId: pid,
      map: "de_dust2",
      playedAt: new Date("2026-06-02T20:00:00Z"),
      result: 1,
      eloAfter: null,
      stats: zeroStats(),
    },
  ]);
});

after(async () => {
  if (!DB_UP || !pid) return;
  await db.delete(players).where(eq(players.id, pid)); // cascade → matchs
});

// REGRESSION : le dernier match reçoit son elo_after sur un changement d'ELO,
// même s'il n'a pas été ingéré ce tick-ci (avant le fix : jamais posé → « — »).
test("setNewestMatchEloAfter pose l'elo_after du dernier match vide", { skip }, async () => {
  const matchId = await dbMatchStatsStore.setNewestMatchEloAfter(pid, 1560);
  assert.equal(matchId, "b213-new");
  assert.equal(await eloAfterOf("b213-new"), 1560);
  assert.equal(await eloAfterOf("b213-old"), 1500); // l'ancien n'est pas touché
});

test("setNewestMatchEloAfter n'écrase pas un elo_after déjà posé", { skip }, async () => {
  // b213-new a maintenant 1560 (test précédent) → nouvel appel = no-op.
  const matchId = await dbMatchStatsStore.setNewestMatchEloAfter(pid, 9999);
  assert.equal(matchId, null);
  assert.equal(await eloAfterOf("b213-new"), 1560);
});
