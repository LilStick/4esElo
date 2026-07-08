import type { OvertakeEntry, OvertakePlayer, PlayerStreak } from "@4eselo/types";

/**
 * Séries & dépassements (B5.5) — logique pure, zéro I/O : les données arrivent
 * en paramètre, les endpoints font les requêtes.
 */

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
  /** ELO au début de la fenêtre ; null = pas suivi à ce moment-là (exclu du calcul). */
  baselineElo: number | null;
}

/** Rang de chaque joueur pour une clé d'ELO donnée (tri desc, égalité départagée par id). */
function ranks(players: OvertakeInput[], key: "elo" | "baselineElo"): Map<string, number> {
  const sorted = players
    .filter((p) => p[key] !== null)
    .sort((a, b) => b[key]! - a[key]! || a.id.localeCompare(b.id));
  return new Map(sorted.map((p, i) => [p.id, i]));
}

/**
 * Qui est passé devant qui entre le début de fenêtre et maintenant.
 * Un joueur sans baseline (arrivé en cours de fenêtre) ne génère aucun dépassement.
 */
export function computeOvertakes(players: OvertakeInput[]): OvertakeEntry[] {
  const before = ranks(players, "baselineElo");
  const now = ranks(players, "elo");
  const overtakes: OvertakeEntry[] = [];

  for (const passer of players) {
    for (const passed of players) {
      if (passer.id === passed.id) continue;
      const pb = before.get(passer.id);
      const db = before.get(passed.id);
      const pn = now.get(passer.id);
      const dn = now.get(passed.id);
      if (pb === undefined || db === undefined || pn === undefined || dn === undefined) continue;
      if (pb > db && pn < dn) {
        overtakes.push({ passer: toOvertakePlayer(passer), passed: toOvertakePlayer(passed) });
      }
    }
  }

  // Les plus hauts au classement actuel d'abord — c'est là que ça se dispute.
  return overtakes.sort(
    (a, b) => now.get(a.passer.id)! - now.get(b.passer.id)! || a.passed.id.localeCompare(b.passed.id),
  );
}

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
