/** Onboarding : clé localStorage + event de replay (partagés entre Tour et déclencheurs). */
export const TOUR_KEY = "4eselo:onboarded";
export const TOUR_REPLAY_EVENT = "4eselo:tour-replay";

/** Relance le tour depuis n'importe où (ex. bouton « Revoir le tuto »). */
export const replayTour = () => window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));

/** En dessous de `lg` (< 1024px) le shell passe en layout mobile : sidebar cachée,
 *  navigation dans un drawer, recherche dans le header. Le tour doit s'y adapter. */
export const TOUR_MOBILE_MAX = 1023;
export const isMobileViewport = (vw: number) => vw <= TOUR_MOBILE_MAX;

/**
 * Largeur de la bulle, bornée à la largeur de l'écran (marge comprise). Fixe la
 * régression mobile : une largeur constante de 340px débordait sur les petits
 * écrans (320-360px) -> bulle coupée / hors cadre. Jamais plus large que le viewport.
 */
export const bubbleWidth = (vw: number, margin: number, max = 340) =>
  Math.max(0, Math.min(max, vw - margin * 2));

/**
 * Cible à mettre en lumière selon le breakpoint. Sur mobile, les ancres de la
 * sidebar desktop sont `display:none` (rect nul -> le tour bloquait 90 frames puis
 * se recentrait). On cible donc les vrais contrôles mobiles, ou on force une bulle
 * centrée quand l'élément n'existe que dans le drawer.
 *
 * - desktop              -> `target`
 * - mobile, cible dédiée -> `targetMobile`
 * - mobile, `null`       -> centré (pas de spotlight)
 * - mobile, absent       -> `target` (élément présent aux deux breakpoints, ex. contenu de page)
 */
export function resolveTarget(
  step: { target?: string; targetMobile?: string | null },
  mobile: boolean,
): string | undefined {
  if (!mobile) return step.target;
  if (step.targetMobile === null) return undefined;
  return step.targetMobile ?? step.target;
}
