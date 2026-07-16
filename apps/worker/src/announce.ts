/** Forme commune d'annonce → un seul store idempotent, dédup sur `dedupeKey`. */

export interface AnnouncementToInsert {
  type: "wrapped" | "weekly-recap" | "big-wrapped";
  title: string;
  /** Texte libre ; absent pour le Wrapped (le lien suffit). */
  body?: string | null;
  /** Chemin interne (ex. /wrapped/juin-2026) ; absent = sans lien. */
  linkUrl?: string | null;
  /** Idempotence (ex. wrapped-2026-06) : l'unicité fait la dédup. */
  dedupeKey: string;
}

export interface AnnouncementStore {
  /** Insert idempotent : false = déjà annoncé. */
  insertUnique(a: AnnouncementToInsert): Promise<boolean>;
}
