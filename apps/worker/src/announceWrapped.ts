/**
 * Annonce mensuelle du Wrapped (B7.4) : dès qu'un mois se termine, une annonce
 * « Le Wrapped de <mois> est là » est insérée pour la home. Pas de check
 * « on est le 1er » : la clé de dédup par mois fait tout - si le worker était
 * down le 1er, l'annonce part à la relance suivante, jamais en double.
 * Logique pure - la DB arrive en interface.
 */
import type { AnnouncementStore } from "./announce";

export type { AnnouncementStore, AnnouncementToInsert } from "./announce";

export interface MonthActivityReader {
  /** Le pôle a-t-il au moins un match stocké sur ce mois ? */
  monthHasMatches(year: number, month: number): Promise<boolean>;
}

export type AnnounceResult =
  | { status: "posted"; year: number; month: number }
  | { status: "already-announced"; year: number; month: number }
  | { status: "empty-month"; year: number; month: number };

/** Slug d'URL du front (cf. apps/web/src/lib/period.ts) : « juin-2026 ». */
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

/** Le mois écoulé (UTC, comme les bornes de /wrapped) : en juillet → juin. */
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
