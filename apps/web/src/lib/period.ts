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
];

/** Parse une période d'URL « juillet-2026 » → { year, month(1-12) } (null si invalide). */
export function parsePeriod(period: string): { year: number; month: number } | null {
  const m = period.match(/^([\p{L}]+)-(\d{4})$/u);
  const name = m?.[1];
  const yr = m?.[2];
  if (!name || !yr) return null;
  const idx = MONTHS.indexOf(name.toLowerCase());
  if (idx < 0) return null;
  return { month: idx + 1, year: Number(yr) };
}

/** { year, month } → slug d'URL « juillet-2026 ». */
export function toPeriod(year: number, month: number): string {
  return `${MONTHS[month - 1]}-${year}`;
}

/** Libellé lisible « juillet 2026 ». */
export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

/** Période du mois courant (slug), pour les liens « Wrapped du mois ». */
export function currentPeriod(): string {
  const d = new Date();
  return toPeriod(d.getFullYear(), d.getMonth() + 1);
}

/** BIG Wrapped (B7.12) - période longue : "2026" (année) | "2026-H1" | "2026-H2". */
export type BigPeriod = { year: number; half: 1 | 2 | null };

/** Parse une période longue d'URL (null si invalide). */
export function parseBigPeriod(period: string): BigPeriod | null {
  const m = period.match(/^(\d{4})(?:-H([12]))?$/);
  if (!m) return null;
  return { year: Number(m[1]), half: m[2] ? (Number(m[2]) as 1 | 2) : null };
}

/** Libellé lisible « Année 2026 » / « 1er semestre 2026 » / « 2e semestre 2026 ». */
export function bigPeriodLabel(p: BigPeriod): string {
  if (p.half === null) return `Année ${p.year}`;
  return `${p.half === 1 ? "1er" : "2e"} semestre ${p.year}`;
}
