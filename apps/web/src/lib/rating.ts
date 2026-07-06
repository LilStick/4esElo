import type { FaceitMatchStats } from "@4eselo/types";

// Constantes HLTV 1.0 (moyennes de référence).
const AVG_KPR = 0.679;
const AVG_SPR = 0.317;
const AVG_RMK = 1.277;

/**
 * Rating façon HLTV 1.0, calculé depuis les stats qu'on stocke.
 * Le nombre de rounds est dérivé de `kr` (kills par round) ; les rounds à 1 kill
 * sont déduits du total de kills moins les multi-kills. Null si non calculable.
 */
export function matchRating(s: FaceitMatchStats): number | null {
  const rounds = s.kr > 0 ? s.kills / s.kr : 0;
  if (rounds <= 0) return null;

  const k2 = s.doubleKills;
  const k3 = s.tripleKills;
  const k4 = s.quadroKills;
  const k5 = s.pentaKills;
  const k1 = Math.max(0, s.kills - (2 * k2 + 3 * k3 + 4 * k4 + 5 * k5));

  const killRating = s.kills / rounds / AVG_KPR;
  const survival = (rounds - s.deaths) / rounds / AVG_SPR;
  const rmk = (1 * k1 + 4 * k2 + 9 * k3 + 16 * k4 + 25 * k5) / rounds / AVG_RMK;

  return (killRating + 0.7 * survival + rmk) / 2.7;
}

/** Couleur du rating : vert si bon (≥ 1), rouge sinon (neutre autour de 1). */
export function ratingColor(r: number): string {
  if (r >= 1.05) return "text-win";
  if (r < 0.95) return "text-loss";
  return "text-ink";
}
