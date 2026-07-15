import type { SyncResult } from "./sync";

/**
 * ±ELO du dernier match (B2.9 → B2.13). L'ELO Faceit ne bouge que sur un match :
 * dès qu'un sync **enregistre** un changement d'ELO, ce nouvel ELO est
 * l'`elo_after` du match le plus récent du joueur. On l'attribue à ce dernier
 * match (s'il n'a pas déjà une valeur) - sans exiger qu'il ait été ingéré au même
 * tick. Ça couvre le décalage Faceit (match listé un tick avant la mise à jour de
 * l'ELO) et les enchaînements de games, là où l'ancienne heuristique
 * « ELO changé ET exactement 1 match ce tick-ci » laissait le dernier match sans
 * delta jusqu'à ce que le joueur rejoue.
 *
 * Limite : si un joueur enchaîne plusieurs games entre deux syncs, seul le plus
 * récent reçoit un `elo_after` fiable ; les intermédiaires restent inconnus (leur
 * ELO par-match n'est pas récupérable - l'endpoint officiel a disparu).
 */
export function eloToAttribute(sync: SyncResult): number | null {
  return sync.status === "recorded" ? sync.elo : null;
}

export interface EloAfterStore {
  /**
   * Pose `elo_after` sur le match le plus récent du joueur, **seulement s'il est
   * encore vide** (n'écrase jamais un backfill ou une valeur déjà posée).
   * Renvoie le matchId mis à jour, ou null si rien à faire (aucun match, ou le
   * plus récent a déjà un `elo_after`).
   */
  setNewestMatchEloAfter(playerId: string, elo: number): Promise<string | null>;
}
