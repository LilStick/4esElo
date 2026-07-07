/** Onboarding : clé localStorage + event de replay (partagés entre Tour et déclencheurs). */
export const TOUR_KEY = "4eselo:onboarded";
export const TOUR_REPLAY_EVENT = "4eselo:tour-replay";

/** Relance le tour depuis n'importe où (ex. bouton « Revoir le tuto »). */
export const replayTour = () => window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
