import type { BenchmarkStatKey, PlayerBenchmarkResponse, StatsAggregate, StatsRange } from "@4eselo/types";
import { percentile } from "./stats";

/**
 * Benchmark intra-asso (B5.11) — fonction pure, zéro I/O. Situe un membre face au pôle
 * sur ses stats clés (percentile « top X% de l'asso »). Le percentile se calcule sur les
 * membres actifs de la fenêtre (≥ seuil de matchs) ; un membre sous le seuil est renvoyé
 * mais sans percentile (`null`), car un échantillon d'1-2 games ne veut rien dire.
 */

/** Nb de matchs minimum sur la fenêtre pour entrer dans le référentiel + être classé. */
export const MIN_BENCHMARK_MATCHES = 10;

/** Les stats classées — pour toutes, « plus haut = mieux » (le percentile se lit tel quel). */
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

/**
 * `null` si le joueur cible n'est pas dans `all` (inconnu). Sinon, par stat :
 * la valeur du membre + son percentile face aux membres au-dessus du seuil.
 */
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
