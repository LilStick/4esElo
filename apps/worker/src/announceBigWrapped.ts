/**
 * Annonce annuelle du BIG Wrapped (B7.12) : dédup par année → idempotent même si
 * le worker était down. Pure logic, DB en interface. (Les Wrapped semestriels
 * restent consultables via `/wrapped/big/:period` ; seule l'annonce annuelle est auto.)
 */
import type { AnnouncementStore } from "./announce";

export interface PeriodActivityReader {
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
