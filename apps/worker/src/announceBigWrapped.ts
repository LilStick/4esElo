/**
 * Annonce du BIG Wrapped annuel (B7.12) : dès qu'une année se termine, une
 * annonce « Le BIG Wrapped <année> est là » est insérée pour la home. Même
 * mécanique que le Wrapped mensuel : pas de check « on est le 1er janvier », la
 * clé de dédup par année fait tout — si le worker était down, l'annonce part à la
 * relance suivante, jamais en double. Logique pure — la DB arrive en interface.
 *
 * (Les Wrapped semestriels restent consultables à la demande via l'endpoint
 *  `/wrapped/big/:period` ; seule l'annonce annuelle — le moment phare — est auto.)
 */
import type { AnnouncementStore } from "./announce";

export interface PeriodActivityReader {
  /** Le pôle a-t-il au moins un match stocké sur [start, end) ? */
  hasMatchesInRange(start: Date, end: Date): Promise<boolean>;
}

export type BigWrappedResult =
  | { status: "posted"; year: number }
  | { status: "already-announced"; year: number }
  | { status: "empty-period"; year: number };

/** L'année écoulée (UTC) : en 2026 → 2025. */
export function previousYear(now: Date): number {
  return now.getUTCFullYear() - 1;
}

export async function announceBigWrapped(
  store: AnnouncementStore,
  reader: PeriodActivityReader,
  now: () => Date = () => new Date(),
): Promise<BigWrappedResult> {
  const year = previousYear(now());
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  if (!(await reader.hasMatchesInRange(start, end))) {
    return { status: "empty-period", year };
  }

  const inserted = await store.insertUnique({
    type: "big-wrapped",
    title: `Le BIG Wrapped ${year} est là 🎆`,
    linkUrl: `/wrapped/big/${year}`,
    dedupeKey: `big-wrapped-${year}`,
  });

  return { status: inserted ? "posted" : "already-announced", year };
}
