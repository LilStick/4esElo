/**
 * Échelle Y du graphe de perf (B18.26). Au lieu d'étirer min→max sur toute la
 * hauteur (courbe collée au bord, graduations à valeurs quelconques), on produit :
 *  - des graduations à **valeurs rondes** (pas de 50/100/… selon l'amplitude) ;
 *  - un domaine **centré sur le dernier point** → la fin de courbe tombe ~au milieu ;
 *  - toutes les données à l'intérieur du domaine, ≤ ~6 lignes de grille.
 */
export interface PerfScale {
  lo: number;
  hi: number;
  step: number;
  ticks: number[];
}

const STEPS = [25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000] as const;
const MAX_LINES = 6;

function buildFor(step: number, values: number[]): PerfScale {
  const last = values[values.length - 1] ?? 0;
  const dataLo = Math.min(...values);
  const dataHi = Math.max(...values);
  // Demi-amplitude autour du dernier point, arrondie au pas → dernier ~centré.
  const need = Math.max(last - dataLo, dataHi - last);
  const half = Math.max(step, Math.ceil((need + step * 0.5) / step) * step);
  let lo = Math.floor((last - half) / step) * step;
  let hi = Math.ceil((last + half) / step) * step;
  // Garantit que toutes les données restent dans le domaine.
  while (dataLo < lo) lo -= step;
  while (dataHi > hi) hi += step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-6; t += step) ticks.push(t);
  return { lo, hi, step, ticks };
}

/** Échelle à valeurs rondes, dernier point ~centré, ≤ 6 graduations. */
export function perfScale(values: number[]): PerfScale {
  if (values.length === 0) return { lo: 0, hi: 100, step: 50, ticks: [0, 50, 100] };
  const span = Math.max(...values) - Math.min(...values);
  // Pas de départ ≈ span/4, puis on grimpe tant qu'il y a trop de lignes.
  const target = span > 0 ? span / 4 : STEPS[0];
  let best = buildFor(STEPS.find((s) => s >= target) ?? STEPS[STEPS.length - 1]!, values);
  for (const step of STEPS) {
    if (step < best.step) continue;
    const s = buildFor(step, values);
    if (s.ticks.length <= MAX_LINES) return s;
    best = s;
  }
  return best;
}
