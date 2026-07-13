import { test } from "node:test";
import assert from "node:assert/strict";
import type { StatsAggregate } from "@4eselo/types";
import { computeBenchmark, MIN_BENCHMARK_MATCHES, type PlayerAggregate } from "./benchmark";

function agg(over: Partial<StatsAggregate> = {}): StatsAggregate {
  return {
    range: "all",
    matches: MIN_BENCHMARK_MATCHES,
    wins: 5,
    winRate: 50,
    kd: 1,
    adr: 70,
    hsPercent: 40,
    clutchWinRate: 30,
    entrySuccessRate: 40,
    utilityDamagePerMatch: 100,
    rating: 1,
    ...over,
  };
}

const p = (playerId: string, over: Partial<StatsAggregate> = {}): PlayerAggregate => ({
  playerId,
  aggregate: agg(over),
});

test("computeBenchmark : le meilleur ADR de l'asso est au 100e percentile", () => {
  const all = [p("a", { adr: 60 }), p("b", { adr: 70 }), p("c", { adr: 80 })];
  const b = computeBenchmark("all", "c", all)!;
  assert.equal(b.qualified, true);
  assert.equal(b.stats.adr.value, 80);
  assert.equal(b.stats.adr.percentile, 100); // ≤ aux 3 → top
  // Le plus bas : ≤ à 1 valeur sur 3 → 33.
  assert.equal(computeBenchmark("all", "a", all)!.stats.adr.percentile, 33);
});

test("computeBenchmark : membre sous le seuil → non classé (percentiles null, valeurs présentes)", () => {
  const all = [p("a", { adr: 70 }), p("b", { adr: 80 }), p("low", { adr: 99, matches: 2 })];
  const b = computeBenchmark("all", "low", all)!;
  assert.equal(b.qualified, false);
  assert.equal(b.matches, 2);
  assert.equal(b.stats.adr.value, 99); // la valeur brute reste lisible
  assert.equal(b.stats.adr.percentile, null); // mais pas de classement
});

test("computeBenchmark : le référentiel exclut les membres sous le seuil", () => {
  // 'low' a un ADR énorme mais trop peu de games → il ne doit pas peser dans le pool.
  const all = [p("me", { adr: 50 }), p("low", { adr: 200, matches: 1 })];
  const b = computeBenchmark("all", "me", all)!;
  // Pool = { me } seulement → me est au top de lui-même.
  assert.equal(b.stats.adr.percentile, 100);
});

test("computeBenchmark : joueur inconnu → null", () => {
  assert.equal(computeBenchmark("all", "ghost", [p("a")]), null);
});

test("computeBenchmark : toutes les stats clés sont renvoyées", () => {
  const b = computeBenchmark("all", "a", [p("a")])!;
  for (const key of ["adr", "kd", "hsPercent", "clutchWinRate", "entrySuccessRate", "winRate"] as const) {
    assert.ok(key in b.stats, `stat ${key} manquante`);
  }
});
