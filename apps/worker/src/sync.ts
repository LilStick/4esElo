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
}

export interface PlayerToSync {
  id: string;
  faceitId: string;
}

export type SyncResult =
  | { status: "recorded"; elo: number; previous: number | null; level: number }
  | { status: "unchanged"; elo: number }
  | { status: "unranked" } // en placement (Season 8+) : ELO caché, pas de point de courbe
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

  // Placement (Season 8+) : ELO caché → on ne pose PAS de snapshot (ne pollue pas la
  // courbe, comme les games de placement Premier). On reprendra une fois classé.
  // On lit le drapeau `unranked` (source de vérité du provider), pas `elo === null`.
  if (profile.cs2.unranked) return { status: "unranked" };
  const { elo, skillLevel } = profile.cs2;
  // Invariant provider : non-unranked ⇒ elo/skillLevel non null. Garde défensive typée.
  if (elo === null || skillLevel === null) return { status: "unranked" };
  const previous = await store.getLatestElo(player.id, "faceit");

  if (previous === elo) return { status: "unchanged", elo };

  await store.insertSnapshot({
    playerId: player.id,
    source: "faceit",
    elo,
    level: skillLevel,
  });

  return { status: "recorded", elo, previous, level: skillLevel };
}
