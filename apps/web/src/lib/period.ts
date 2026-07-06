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
