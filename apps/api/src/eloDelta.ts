/**
 * ±ELO effectif d'un match (B2.12). La colonne `elo_delta` n'est remplie que par
 * le backfill (#141, endpoint non officiel souvent 403). En attendant, on dérive
 * le delta des `elo_after` consécutifs qu'on possède déjà : l'ELO ne bouge que
 * sur un match → `eloDelta(i) = eloAfter(i) − eloAfter(i−1)`. Le backfill reste
 * prioritaire (vraie valeur) ; on ne dérive que si les deux `elo_after` sont
 * connus, sinon null (« missing beats wrong »).
 */
export function effectiveEloDelta(
  eloDelta: number | null,
  eloAfter: number | null,
  prevEloAfter: number | null,
): number | null {
  if (eloDelta !== null) return eloDelta;
  if (eloAfter !== null && prevEloAfter !== null) return eloAfter - prevEloAfter;
  return null;
}
