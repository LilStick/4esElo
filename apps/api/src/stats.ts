import type { FaceitMatchStats, MapStat, StatsAggregate, StatsRange } from "@4eselo/types";

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
  }

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
