import { hltvRating, type FaceitMatchStats } from "@4eselo/types";

/**
 * Rating façon HLTV 1.0 d'un match - délègue à la formule partagée `hltvRating`
 * (source unique front/back, #298). Le nombre de rounds est dérivé de `kr`
 * (kills par round). Null si non calculable.
 */
export function matchRating(s: FaceitMatchStats): number | null {
  return hltvRating({
    kills: s.kills,
    deaths: s.deaths,
    rounds: s.kr > 0 ? s.kills / s.kr : 0,
    doubleKills: s.doubleKills,
    tripleKills: s.tripleKills,
    quadroKills: s.quadroKills,
    pentaKills: s.pentaKills,
  });
}

/** Couleur du rating : vert si bon (≥ 1), rouge sinon (neutre autour de 1). */
export function ratingColor(r: number): string {
  if (r >= 1.05) return "text-win";
  if (r < 0.95) return "text-loss";
  return "text-ink";
}
