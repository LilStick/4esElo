import type { SyncResult } from "./sync";

/**
 * ±ELO du dernier match (B2.9 → B2.13). Le match le plus récent a **par définition**
 * pour elo_after l'ELO **courant** (rien n'a été joué après lui) → on renvoie l'ELO
 * dès qu'on le connaît (changement OU stable), pas seulement sur un changement.
 * `setNewestMatchEloAfter` ne remplit que si c'est encore vide → idempotent, et ça
 * RATTRAPE le dernier match dont le ±ELO avait été perdu : quand le changement d'ELO
 * est détecté avant que Faceit publie les stats du match (le match n'est pas encore
 * ingéré ce tick-là), l'attribution tombait sur le match précédent déjà rempli et le
 * delta était droppé pour toujours ; désormais le passage « unchanged » suivant le pose.
 *
 * Limite : plusieurs games entre deux syncs → seul le plus récent a un elo_after
 * fiable ; les intermédiaires restent inconnus (endpoint officiel disparu).
 */
export function eloToAttribute(sync: SyncResult): number | null {
  return "elo" in sync ? sync.elo : null;
}

export interface EloAfterStore {
  /**
   * Pose `elo_after` sur le match le plus récent, seulement s'il est vide
   * (n'écrase jamais un backfill). Renvoie le matchId, ou null si rien à faire.
   */
  setNewestMatchEloAfter(playerId: string, elo: number): Promise<string | null>;
}
