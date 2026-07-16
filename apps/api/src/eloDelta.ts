/**
 * ±ELO effectif (B2.12). `elo_delta` (backfill, #141, souvent 403) prime ; sinon on
 * dérive de eloAfter(i) − eloAfter(i−1), et null si l'un manque (« missing beats wrong »).
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
