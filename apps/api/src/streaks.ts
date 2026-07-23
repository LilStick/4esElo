import type { OvertakeEntry, OvertakePlayer, PlayerStreak } from "@4eselo/types";

/** Séries & dépassements (B5.5), logique pure. */

/** Résultats du plus récent au plus ancien (1 = win, 0 = loss). */
export function computeStreak(resultsNewestFirst: number[]): PlayerStreak {
  if (resultsNewestFirst.length === 0) {
    return { current: null, bestWinStreak: 0, worstLossStreak: 0 };
  }

  let bestWin = 0;
  let worstLoss = 0;
  let run = 0;
  let runValue = resultsNewestFirst[0]!;
  let currentLength = 0;
  let currentClosed = false;

  for (const result of resultsNewestFirst) {
    if (result === runValue) {
      run += 1;
    } else {
      runValue = result;
      run = 1;
      currentClosed = true;
    }
    if (!currentClosed) currentLength = run;
    if (runValue === 1) bestWin = Math.max(bestWin, run);
    else worstLoss = Math.max(worstLoss, run);
  }

  return {
    current: { type: resultsNewestFirst[0] === 1 ? "win" : "loss", length: currentLength },
    bestWinStreak: bestWin,
    worstLossStreak: worstLoss,
  };
}

export interface OvertakeInput extends OvertakePlayer {
  /** ELO au début de la fenêtre ; null = non suivi alors (exclu). */
  baselineElo: number | null;
  /** Snapshots DANS la fenêtre (captured_at > windowStart), triés du + ancien au + récent. */
  history: { at: number; elo: number }[];
}

/** ELO du joueur au temps t : dernier snapshot <= t, sinon la baseline. */
function eloAt(baseline: number, history: { at: number; elo: number }[], t: number): number {
  let elo = baseline;
  for (const h of history) {
    if (h.at <= t) elo = h.elo;
    else break;
  }
  return elo;
}

/**
 * Historique des dépassements sur la fenêtre (B5.5, refonte event-based) : chaque
 * CROISEMENT d'ELO entre deux membres est un event horodaté. On rejoue les snapshots
 * de la fenêtre, un changement de signe de (eloA - eloB) = un dépassement au moment t.
 * Sans baseline (arrivé en cours) = paire ignorée. Un re-dépassement crée un 2e event.
 */
export function computeOvertakeEvents(players: OvertakeInput[]): OvertakeEntry[] {
  const tracked = players.filter((p) => p.baselineElo !== null);
  const events: OvertakeEntry[] = [];

  for (let i = 0; i < tracked.length; i++) {
    for (let j = i + 1; j < tracked.length; j++) {
      const a = tracked[i]!;
      const b = tracked[j]!;
      // Instants où l'un OU l'autre change d'ELO dans la fenêtre.
      const times = [...new Set([...a.history, ...b.history].map((h) => h.at))].sort((x, y) => x - y);
      let prevSign = Math.sign(a.baselineElo! - b.baselineElo!);
      for (const t of times) {
        const diff = eloAt(a.baselineElo!, a.history, t) - eloAt(b.baselineElo!, b.history, t);
        const sign = Math.sign(diff);
        if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
          const [passer, passed] = sign > 0 ? [a, b] : [b, a];
          events.push({ passer: toOvertakePlayer(passer), passed: toOvertakePlayer(passed), at: iso(t) });
        }
        if (sign !== 0) prevSign = sign; // une égalité ne réinitialise pas l'ordre
      }
    }
  }

  // Les plus récents d'abord.
  return events.sort((x, y) => y.at.localeCompare(x.at) || x.passer.id.localeCompare(y.passer.id));
}

const iso = (ms: number): string => new Date(ms).toISOString();

function toOvertakePlayer(p: OvertakeInput): OvertakePlayer {
  return {
    id: p.id,
    discordId: p.discordId,
    faceitNickname: p.faceitNickname,
    discordName: p.discordName,
    discordAvatar: p.discordAvatar,
    elo: p.elo,
  };
}
