/**
 * Watchdog de la session Game Coordinator (B18.x). Une déco GC brève se répare
 * seule (relance `gamesPlayed`), mais on a vu une session rester HS pendant des
 * jours sans reconnexion : le résolveur throwait alors à chaque passage, tous les
 * curseurs Premier gelaient, et aucun match ne remontait — en silence. Le cold-start
 * du bot, lui, marche de façon fiable.
 *
 * Donc : si le GC reste déconnecté au-delà de `downMs`, on abandonne (onTimeout =
 * exit process en prod) pour que l'orchestrateur redémarre le worker à froid.
 * Logique pure (timers injectables) → testable sans I/O ni vrai Steam.
 */
export interface GcWatchdogDeps {
  /** Durée max de déconnexion GC tolérée avant abandon. */
  downMs: number;
  /** Appelé si le GC reste déconnecté au-delà de downMs. En prod : log + exit. */
  onTimeout: (downMs: number) => void;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (h: ReturnType<typeof setTimeout>) => void;
}

export interface GcWatchdog {
  /** GC déconnecté : arme le compte à rebours (ne prolonge pas un compte déjà armé). */
  markDown(): void;
  /** GC (re)connecté : désarme le compte à rebours. */
  markUp(): void;
}

export function createGcWatchdog(deps: GcWatchdogDeps): GcWatchdog {
  const setTimer = deps.setTimer ?? setTimeout;
  const clearTimer = deps.clearTimer ?? clearTimeout;
  let handle: ReturnType<typeof setTimeout> | null = null;
  return {
    markDown() {
      if (handle !== null) return; // déjà armé : on ne redémarre pas le compte
      handle = setTimer(() => {
        handle = null;
        deps.onTimeout(deps.downMs);
      }, deps.downMs);
    },
    markUp() {
      if (handle !== null) {
        clearTimer(handle);
        handle = null;
      }
    },
  };
}
