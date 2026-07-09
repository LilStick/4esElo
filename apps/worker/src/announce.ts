/**
 * Contrat commun d'insertion d'annonce (Wrapped mensuel B7.4, recap hebdo B5.7,
 * annonce staff B17.4). Une seule forme → un seul store DB idempotent, la dédup
 * repose sur `dedupeKey`. Logique pure : la DB arrive via cette interface.
 */

export interface AnnouncementToInsert {
  type: "wrapped" | "weekly-recap" | "big-wrapped";
  title: string;
  /** Texte libre de l'annonce (recap hebdo) ; absent pour le Wrapped (le lien suffit). */
  body?: string | null;
  /** Chemin interne du site (ex. /wrapped/juin-2026) ; absent = annonce sans lien. */
  linkUrl?: string | null;
  /** Idempotence (ex. wrapped-2026-06) : l'unicité fait la dédup, relance sans doublon. */
  dedupeKey: string;
}

export interface AnnouncementStore {
  /** Insert idempotent (unicité sur dedupeKey) : false = déjà annoncé. */
  insertUnique(a: AnnouncementToInsert): Promise<boolean>;
}
