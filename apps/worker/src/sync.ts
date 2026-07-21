import type { EloSource } from "@4eselo/types";
import { FaceitNotFoundError, type FaceitPlayer } from "@4eselo/faceit";

/**
 * Ce dont sync a besoin du monde extérieur, en interfaces étroites (impl réelle =
 * client Faceit + DB, tests = fakes) → syncPlayer() reste pure logic, zéro I/O.
 */
export interface FaceitReader {
  getPlayerById(faceitId: string): Promise<FaceitPlayer>;
}

export interface SnapshotStore {
  getLatestElo(playerId: string, source: EloSource): Promise<number | null>;
  insertSnapshot(input: {
    playerId: string;
    source: EloSource;
    elo: number;
    level: number | null;
  }): Promise<void>;
  /**
   * Rattrape le steamId64 (vu dans le profil Faceit) s'il manque en base.
   * true = une valeur a été écrite. Requis pour le sync Premier (walk).
   */
  backfillSteamId64(playerId: string, steamId64: string): Promise<boolean>;
}

export interface PlayerToSync {
  id: string;
  faceitId: string;
}

export type SyncResult =
  | { status: "recorded"; elo: number; previous: number | null; level: number; steamIdFilled: boolean }
  | { status: "unchanged"; elo: number; steamIdFilled: boolean }
  | { status: "no-cs2" }
  | { status: "not-found" };

/**
 * Sync l'ELO Faceit d'un joueur. Insère un snapshot UNIQUEMENT si l'ELO a changé
 * (pattern Calibrum) → courbe propre, pas un point par tick.
 */
export async function syncPlayer(
  faceit: FaceitReader,
  store: SnapshotStore,
  player: PlayerToSync,
): Promise<SyncResult> {
  let profile: FaceitPlayer;
  try {
    profile = await faceit.getPlayerById(player.faceitId);
  } catch (err) {
    if (err instanceof FaceitNotFoundError) return { status: "not-found" };
    throw err;
  }

  if (!profile.cs2) return { status: "no-cs2" };

  const { elo, skillLevel, steamId64 } = profile.cs2;
  const steamIdFilled = steamId64 ? await store.backfillSteamId64(player.id, steamId64) : false;
  const previous = await store.getLatestElo(player.id, "faceit");

  if (previous === elo) return { status: "unchanged", elo, steamIdFilled };

  await store.insertSnapshot({
    playerId: player.id,
    source: "faceit",
    elo,
    level: skillLevel,
  });

  return { status: "recorded", elo, previous, level: skillLevel, steamIdFilled };
}
