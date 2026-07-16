/**
 * Annonce mensuelle du Wrapped (B7.4) : dédup par mois → idempotent même si le
 * worker était down le 1er. Pure logic, DB en interface.
 */
import type { AnnouncementStore } from "./announce";

export type { AnnouncementStore, AnnouncementToInsert } from "./announce";

export interface MonthActivityReader {
  monthHasMatches(year: number, month: number): Promise<boolean>;
}

export type AnnounceResult =
  | { status: "posted"; year: number; month: number }
  | { status: "already-announced"; year: number; month: number }
  | { status: "empty-month"; year: number; month: number };

/** Slug d'URL front (cf. apps/web/src/lib/period.ts) : « juin-2026 ». */
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** Le mois écoulé (UTC, comme /wrapped) : juillet → juin. */
export function previousMonth(now: Date): { year: number; month: number } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1; // 1-12
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

export async function announceWrapped(
  store: AnnouncementStore,
  reader: MonthActivityReader,
  now: () => Date = () => new Date(),
): Promise<AnnounceResult> {
  const { year, month } = previousMonth(now());

  if (!(await reader.monthHasMatches(year, month))) {
    return { status: "empty-month", year, month };
  }

  const slug = `${MONTHS[month - 1]}-${year}`;
  const inserted = await store.insertUnique({
    type: "wrapped",
    title: `Le Wrapped de ${MONTHS[month - 1]} est là 🎁`,
    linkUrl: `/wrapped/${slug}`,
    dedupeKey: `wrapped-${year}-${String(month).padStart(2, "0")}`,
  });

  return { status: inserted ? "posted" : "already-announced", year, month };
}
