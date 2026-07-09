import { db, players, eloSnapshots, faceitMatchStats } from "@4eselo/db";
import { eq } from "drizzle-orm";
import type { FaceitMatchStats } from "@4eselo/types";

/**
 * Données de seed déterministes pour l'e2e. Un joueur à id fixe (facile à cibler
 * dans les tests) + une petite courbe + quelques matchs. Nettoyé en teardown via
 * le cascade sur players.id. Préfixe `e2e_` → jamais confondu avec de vraies data.
 */
export const E2E_PLAYER_ID = "e2e00000-0000-0000-0000-000000000001";
export const E2E_NICKNAME = "e2e_seed_player";

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

export async function seed(): Promise<void> {
  await cleanup();
  await db
    .insert(players)
    .values({ id: E2E_PLAYER_ID, discordName: "e2e_seed", faceitNickname: E2E_NICKNAME });
  await db.insert(eloSnapshots).values([
    {
      playerId: E2E_PLAYER_ID,
      source: "faceit",
      elo: 1500,
      level: 6,
      capturedAt: new Date("2026-05-01T00:00:00Z"),
    },
    {
      playerId: E2E_PLAYER_ID,
      source: "faceit",
      elo: 1620,
      level: 7,
      capturedAt: new Date("2026-06-01T00:00:00Z"),
    },
  ]);
  await db.insert(faceitMatchStats).values([
    {
      matchId: "e2e-m1",
      playerId: E2E_PLAYER_ID,
      map: "de_mirage",
      playedAt: new Date("2026-05-15T20:00:00Z"),
      result: 1,
      eloAfter: 1560,
      stats: zeroStats({ kills: 22, deaths: 12, adr: 88, kr: 0.8, hsPercent: 52 }),
    },
    {
      matchId: "e2e-m2",
      playerId: E2E_PLAYER_ID,
      map: "de_dust2",
      playedAt: new Date("2026-05-20T20:00:00Z"),
      result: 0,
      eloAfter: 1540,
      stats: zeroStats({ kills: 14, deaths: 18, adr: 66, kr: 0.6, hsPercent: 44 }),
    },
  ]);
}

export async function cleanup(): Promise<void> {
  // cascade : supprime aussi snapshots + matchs du joueur.
  await db.delete(players).where(eq(players.id, E2E_PLAYER_ID));
}
