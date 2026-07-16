/**
 * Promo EFREI (B17.3) : helpers d'affichage. `promoEnd` passé = Alumni 🎓.
 * Les champs viennent du register (B17.6) ; null tant que la personne n'a pas
 * renseigné sa promo.
 */

/** Fin de promo révolue (année UTC courante) → Alumni. */
export const isAlumni = (promoEnd: number | null | undefined, now = new Date()): boolean =>
  promoEnd != null && promoEnd < now.getUTCFullYear();

/** Libellé court de promo : « 2026-28 », ou « 2026 » si une seule borne. null si rien. */
export function promoLabel(start: number | null | undefined, end: number | null | undefined): string | null {
  if (start != null && end != null) return `${start}-${String(end).slice(-2)}`;
  const one = start ?? end;
  return one != null ? String(one) : null;
}
