import type { SyncResult } from "./sync";

/**
 * ±ELO du dernier match (B2.9 → B2.13). L'ELO Faceit ne bouge que sur un match :
 * dès qu'un sync **enregistre** un changement, on attribue ce nouvel ELO au match
 * le plus récent du joueur (s'il n'en a pas déjà un) - sans exiger qu'il ait été
 * ingéré au même tick (tolère le décalage Faceit et les enchaînements de games).
 *
 * Limite : plusieurs games entre deux syncs → seul le plus récent a un elo_after
 * fiable ; les intermédiaires restent inconnus (endpoint officiel disparu).
 */
export function eloToAttribute(sync: SyncResult): number | null {
  return sync.status === "recorded" ? sync.elo : null;
}

export interface EloAfterStore {
  /**
   * Pose `elo_after` sur le match le plus récent, seulement s'il est vide
   * (n'écrase jamais un backfill). Renvoie le matchId, ou null si rien à faire.
   */
  setNewestMatchEloAfter(playerId: string, elo: number): Promise<string | null>;
}
