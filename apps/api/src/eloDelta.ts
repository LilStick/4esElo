/**
 * ±ELO effectif (B2.12). `elo_delta` (backfill, #141, souvent 403) prime ; sinon on
 * dérive de eloAfter(i) − eloAfter(i−1), et null si l'un manque (« missing beats wrong »).
 *
 * Un dérivé valant exactement 0 est renvoyé `null` (B19.3) : un vrai match Faceit ne
 * fait JAMAIS 0 (win/loss bougent toujours l'ELO), donc un 0 dérivé = deux relevés
 * eloAfter identiques de part et d'autre d'un trou/soft reset, pas une info réelle →
 * on affiche « — » plutôt qu'un faux « +0 ». La colonne backfill, elle, reste prise
 * telle quelle (source fiable, on ne la réinterprète pas).
 */
export function effectiveEloDelta(
  eloDelta: number | null,
  eloAfter: number | null,
  prevEloAfter: number | null,
): number | null {
  if (eloDelta !== null) return eloDelta;
  if (eloAfter !== null && prevEloAfter !== null) {
    const derived = eloAfter - prevEloAfter;
    return derived === 0 ? null : derived;
  }
  return null;
}
