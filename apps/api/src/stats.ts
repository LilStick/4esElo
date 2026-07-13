import {
  hltvRating,
  type FaceitMatchStats,
  type MapStat,
  type MapLeaderboard,
  type MapLeaderboardEntry,
  type StatsAggregate,
  type StatsRange,
} from "@4eselo/types";

/**
 * Aggregation over stored matches (B2.7) — pure functions, no I/O.
 * Ratios are computed from summed numerators/denominators (not averaged
 * per-match ratios) so short matches don't weigh as much as long ones.
 */

export interface MatchForStats {
  map: string;
  result: number; // 1 win, 0 loss
  stats: FaceitMatchStats;
}

export const RANGES = ["7d", "30d", "3m", "all"] as const satisfies readonly StatsRange[];

const RANGE_DAYS: Record<Exclude<StatsRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "3m": 90,
};

/** Start of the window, or null for "all". */
export function rangeCutoff(range: StatsRange, now: Date): Date | null {
  if (range === "all") return null;
  return new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (num: number, den: number) => (den > 0 ? round1((num / den) * 100) : 0);
const ratio = (num: number, den: number) => (den > 0 ? round1(num / den) : num > 0 ? num : 0);

/**
 * Percentile 0-100 : part de l'échantillon dont la valeur est ≤ `value` (ta place, incluse).
 * Partagé Wrapped (percentiles perso) ↔ benchmark asso (B5.11). Échantillon vide → 0.
 */
export function percentile(value: number, all: number[]): number {
  if (all.length === 0) return 0;
  return Math.round((all.filter((v) => v <= value).length / all.length) * 100);
}

export function computeAggregate(range: StatsRange, matches: MatchForStats[]): StatsAggregate {
  const n = matches.length;
  let wins = 0;
  let kills = 0;
  let deaths = 0;
  let damage = 0;
  let hsSum = 0;
  let clutchWins = 0;
  let clutchCount = 0;
  let entryWins = 0;
  let entryCount = 0;
  let utilityDamage = 0;
  // Composants du rating HLTV 1.0 agrégé (B16.8) — rounds dérivés de kr par match.
  let rounds = 0;
  let dbl = 0;
  let tpl = 0;
  let quad = 0;
  let penta = 0;

  for (const m of matches) {
    wins += m.result;
    kills += m.stats.kills;
    deaths += m.stats.deaths;
    damage += m.stats.adr; // per-match ADR, averaged below
    hsSum += m.stats.hsPercent;
    clutchWins += m.stats.clutch1v1Wins + m.stats.clutch1v2Wins;
    clutchCount += m.stats.clutch1v1Count + m.stats.clutch1v2Count;
    entryWins += m.stats.entryWins;
    entryCount += m.stats.entryCount;
    utilityDamage += m.stats.utilityDamage;
    rounds += m.stats.kr > 0 ? m.stats.kills / m.stats.kr : 0;
    dbl += m.stats.doubleKills;
    tpl += m.stats.tripleKills;
    quad += m.stats.quadroKills;
    penta += m.stats.pentaKills;
  }

  const rawRating = hltvRating({
    kills,
    deaths,
    rounds,
    doubleKills: dbl,
    tripleKills: tpl,
    quadroKills: quad,
    pentaKills: penta,
  });

  return {
    range,
    matches: n,
    wins,
    winRate: pct(wins, n),
    kd: ratio(kills, deaths),
    adr: n > 0 ? round1(damage / n) : 0,
    hsPercent: n > 0 ? round1(hsSum / n) : 0,
    clutchWinRate: pct(clutchWins, clutchCount),
    entrySuccessRate: pct(entryWins, entryCount),
    utilityDamagePerMatch: n > 0 ? round1(utilityDamage / n) : 0,
    rating: rawRating === null ? null : Math.round(rawRating * 100) / 100,
  };
}

export function computeMapStats(matches: MatchForStats[]): MapStat[] {
  const byMap = new Map<string, MatchForStats[]>();
  for (const m of matches) {
    const list = byMap.get(m.map) ?? [];
    list.push(m);
    byMap.set(m.map, list);
  }

  const out: MapStat[] = [];
  for (const [map, list] of byMap) {
    const wins = list.reduce((s, m) => s + m.result, 0);
    const kills = list.reduce((s, m) => s + m.stats.kills, 0);
    const deaths = list.reduce((s, m) => s + m.stats.deaths, 0);
    const adrSum = list.reduce((s, m) => s + m.stats.adr, 0);
    out.push({
      map,
      matches: list.length,
      wins,
      winRate: pct(wins, list.length),
      kd: ratio(kills, deaths),
      adr: round1(adrSum / list.length),
    });
  }

  // Most played first, then alphabetical for stable output.
  return out.sort((a, b) => b.matches - a.matches || a.map.localeCompare(b.map));
}

/** Games ensemble minimum pour qu'un joueur apparaisse au classement d'une map (B13.6). */
export const MIN_MAP_MATCHES = 5;

export interface MapLeaderboardPlayer {
  id: string;
  nickname: string;
  discordId: string | null;
  discordAvatar: string | null;
}

export interface MapLeaderboardRow {
  playerId: string;
  map: string;
  result: number; // 1 win, 0 loss
  kills: number;
  deaths: number;
}

/**
 * Classement du pôle par map (B13.6) — logique pure. Par map, chaque membre au-dessus
 * du seuil de games est classé par winrate (puis volume, puis K-D). Maps triées par
 * activité totale.
 */
export function computeMapLeaderboard(
  players: MapLeaderboardPlayer[],
  rows: MapLeaderboardRow[],
  minMatches: number = MIN_MAP_MATCHES,
): MapLeaderboard[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const byMap = new Map<string, Map<string, { m: number; w: number; k: number; d: number }>>();

  for (const r of rows) {
    if (!byId.has(r.playerId)) continue;
    const pmap = byMap.get(r.map) ?? new Map();
    byMap.set(r.map, pmap);
    const e = pmap.get(r.playerId) ?? { m: 0, w: 0, k: 0, d: 0 };
    e.m += 1;
    e.w += r.result;
    e.k += r.kills;
    e.d += r.deaths;
    pmap.set(r.playerId, e);
  }

  const out: MapLeaderboard[] = [];
  for (const [map, pmap] of byMap) {
    const entries: MapLeaderboardEntry[] = [];
    for (const [pid, e] of pmap) {
      if (e.m < minMatches) continue;
      const p = byId.get(pid)!;
      entries.push({
        player: { id: p.id, nickname: p.nickname, discordId: p.discordId, discordAvatar: p.discordAvatar },
        matches: e.m,
        wins: e.w,
        winRate: pct(e.w, e.m),
        kd: ratio(e.k, e.d),
      });
    }
    if (entries.length === 0) continue;
    entries.sort(
      (a, b) =>
        b.winRate - a.winRate ||
        b.matches - a.matches ||
        b.kd - a.kd ||
        a.player.nickname.localeCompare(b.player.nickname),
    );
    out.push({ map, players: entries });
  }

  const total = (l: MapLeaderboard) => l.players.reduce((s, e) => s + e.matches, 0);
  return out.sort((a, b) => total(b) - total(a) || a.map.localeCompare(b.map));
}
