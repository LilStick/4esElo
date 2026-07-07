import type { DuoPlayer, DuoStat } from "@4eselo/types";

/**
 * Duos (B4.1) — fonctions pures, zéro I/O. Deux membres dans le même match
 * avec le même résultat étaient coéquipiers (une seule équipe gagne) ; des
 * résultats opposés = adversaires, ignorés. Le head-to-head a été écarté :
 * quasi impossible en matchmaking (décision 2026-07-07, cf. #227).
 */

export interface SocialMatchRow {
  matchId: string;
  playerId: string;
  result: number; // 1 win, 0 loss
}

/** Games ensemble minimum pour qu'un duo apparaisse (anti « 100% sur 1 game »). */
export const MIN_DUO_MATCHES = 5;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Clé stable d'une paire, indépendante de l'ordre. */
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function computeDuos(
  players: DuoPlayer[],
  matches: SocialMatchRow[],
  minMatches: number = MIN_DUO_MATCHES,
): DuoStat[] {
  const byId = new Map(players.map((p) => [p.id, p]));

  // matchId → joueurs présents, groupés par résultat (même résultat = même équipe).
  const byMatch = new Map<string, SocialMatchRow[]>();
  for (const m of matches) {
    if (!byId.has(m.playerId)) continue;
    const list = byMatch.get(m.matchId) ?? [];
    list.push(m);
    byMatch.set(m.matchId, list);
  }

  const pairs = new Map<string, { a: DuoPlayer; b: DuoPlayer; matches: number; wins: number }>();
  for (const rows of byMatch.values()) {
    if (rows.length < 2) continue;
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const x = rows[i]!;
        const y = rows[j]!;
        if (x.result !== y.result) continue; // adversaires
        const key = pairKey(x.playerId, y.playerId);
        const entry = pairs.get(key) ?? {
          a: byId.get(x.playerId)!,
          b: byId.get(y.playerId)!,
          matches: 0,
          wins: 0,
        };
        entry.matches += 1;
        entry.wins += x.result;
        pairs.set(key, entry);
      }
    }
  }

  const out: DuoStat[] = [];
  for (const { a, b, matches: n, wins } of pairs.values()) {
    if (n < minMatches) continue;
    const [first, second] = a.nickname.localeCompare(b.nickname) <= 0 ? [a, b] : [b, a];
    out.push({
      players: [first, second],
      matches: n,
      wins,
      winRate: round1((wins / n) * 100),
    });
  }

  // Meilleur duo d'abord ; à winrate égal, celui qui a le plus joué ensemble.
  return out.sort(
    (x, y) =>
      y.winRate - x.winRate ||
      y.matches - x.matches ||
      x.players[0].nickname.localeCompare(y.players[0].nickname),
  );
}

/** Les duos d'un joueur donné, mêmes règles, meilleurs coéquipiers d'abord. */
export function computePlayerDuos(
  playerId: string,
  players: DuoPlayer[],
  matches: SocialMatchRow[],
  minMatches: number = MIN_DUO_MATCHES,
): DuoStat[] {
  return computeDuos(players, matches, minMatches).filter((d) => d.players.some((p) => p.id === playerId));
}
