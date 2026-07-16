/** Helpers de pagination (purs, testables) partagés par les listes de joueurs. */

/** Nombre de pages pour `total` éléments par paquets de `size` (>= 1). */
export const pageCountOf = (total: number, size: number) => Math.max(1, Math.ceil(total / Math.max(1, size)));

/** Ramène `page` dans [0, count-1] (jamais hors bornes après un resize/filtre). */
export const clampPage = (page: number, count: number) => Math.min(Math.max(0, page), Math.max(0, count - 1));

/**
 * Fenêtre de numéros de page à afficher autour de la page courante (0-based),
 * avec des ellipses. `span` = nb de voisins de chaque côté. Toujours 1re + dernière.
 * Retourne des numéros 1-based (pour l'affichage) et la chaîne "…" pour les trous.
 * Ex. (page=5, count=12, span=1) -> [1, "…", 5, 6, 7, "…", 12]
 */
export function pageWindow(page: number, count: number, span = 1): (number | "…")[] {
  if (count <= 1) return [1];
  const cur = clampPage(page, count) + 1; // 1-based
  const pages = new Set<number>([1, count]);
  for (let p = cur - span; p <= cur + span; p++) {
    if (p >= 1 && p <= count) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}
