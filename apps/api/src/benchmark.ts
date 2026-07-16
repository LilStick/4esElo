import type { BenchmarkStatKey, PlayerBenchmarkResponse, StatsAggregate, StatsRange } from "@4eselo/types";
import { percentile } from "./stats";

/**
 * Benchmark intra-asso (B5.11), pure. Percentile « top X% » calculé sur les
 * membres actifs (≥ seuil de matchs) ; sous le seuil → renvoyé sans percentile (null).
 */

/** Matchs min. pour entrer au référentiel + être classé. */
export const MIN_BENCHMARK_MATCHES = 10;

/** Stats classées ; pour toutes « plus haut = mieux ». */
export const BENCHMARK_KEYS = [
  "adr",
  "kd",
  "hsPercent",
  "clutchWinRate",
  "entrySuccessRate",
  "winRate",
] as const satisfies readonly BenchmarkStatKey[];

export interface PlayerAggregate {
  playerId: string;
  aggregate: StatsAggregate;
}

/** null si cible inconnue. Sinon par stat : valeur + percentile vs membres ≥ seuil. */
export function computeBenchmark(
  range: StatsRange,
  targetId: string,
  all: PlayerAggregate[],
  minMatches: number = MIN_BENCHMARK_MATCHES,
): PlayerBenchmarkResponse | null {
  const target = all.find((p) => p.playerId === targetId);
  if (!target) return null;

  const pool = all.filter((p) => p.aggregate.matches >= minMatches);
  const qualified = target.aggregate.matches >= minMatches;

  const stats = {} as Record<BenchmarkStatKey, { value: number; percentile: number | null }>;
  for (const key of BENCHMARK_KEYS) {
    const value = target.aggregate[key];
    stats[key] = {
      value,
      percentile: qualified
        ? percentile(
            value,
            pool.map((p) => p.aggregate[key]),
          )
        : null,
    };
  }

  return { range, matches: target.aggregate.matches, qualified, stats };
}
