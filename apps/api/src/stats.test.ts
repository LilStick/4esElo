import { test } from "node:test";
import assert from "node:assert/strict";
import type { FaceitMatchStats } from "@4eselo/types";
import { computeAggregate, computeMapStats, rangeCutoff, type MatchForStats } from "./stats";

function makeStats(over: Partial<FaceitMatchStats> = {}): FaceitMatchStats {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    kd: 0,
    kr: 0,
    adr: 0,
    damage: 0,
    hsPercent: 0,
    mvps: 0,
    doubleKills: 0,
    tripleKills: 0,
    quadroKills: 0,
    pentaKills: 0,
    clutch1v1Count: 0,
    clutch1v1Wins: 0,
    clutch1v2Count: 0,
    clutch1v2Wins: 0,
    clutchKills: 0,
    entryCount: 0,
    entryWins: 0,
    firstKills: 0,
    utilityDamage: 0,
    utilityCount: 0,
    flashCount: 0,
    enemiesFlashed: 0,
    flashSuccesses: 0,
    sniperKills: 0,
    ...over,
  };
}

const match = (map: string, result: number, over: Partial<FaceitMatchStats>): MatchForStats => ({
  map,
  result,
  stats: makeStats(over),
});

test("aggregate: winrate, K/D and ADR from summed values", () => {
  const agg = computeAggregate("all", [
    match("de_mirage", 1, { kills: 20, deaths: 10, adr: 90, hsPercent: 50 }),
    match("de_dust2", 0, { kills: 10, deaths: 20, adr: 60, hsPercent: 30 }),
  ]);

  assert.equal(agg.matches, 2);
  assert.equal(agg.wins, 1);
  assert.equal(agg.winRate, 50);
  assert.equal(agg.kd, 1); // 30 kills / 30 deaths — summed, not mean of ratios
  assert.equal(agg.adr, 75);
  assert.equal(agg.hsPercent, 40);
});

test("aggregate: clutch and entry rates from summed numerators/denominators", () => {
  const agg = computeAggregate("all", [
    match("de_mirage", 1, {
      clutch1v1Count: 2,
      clutch1v1Wins: 1,
      clutch1v2Count: 1,
      clutch1v2Wins: 0,
      entryCount: 4,
      entryWins: 3,
      utilityDamage: 120,
    }),
    match("de_dust2", 1, {
      clutch1v1Count: 1,
      clutch1v1Wins: 1,
      entryCount: 6,
      entryWins: 2,
      utilityDamage: 80,
    }),
  ]);

  assert.equal(agg.clutchWinRate, 50); // 2 wins / 4 situations
  assert.equal(agg.entrySuccessRate, 50); // 5 / 10
  assert.equal(agg.utilityDamagePerMatch, 100);
});

test("aggregate: zero matches → all zeros, no NaN", () => {
  const agg = computeAggregate("7d", []);
  assert.deepEqual(agg, {
    range: "7d",
    matches: 0,
    wins: 0,
    winRate: 0,
    kd: 0,
    adr: 0,
    hsPercent: 0,
    clutchWinRate: 0,
    entrySuccessRate: 0,
    utilityDamagePerMatch: 0,
  });
});

test("aggregate: zero deaths does not divide by zero", () => {
  const agg = computeAggregate("all", [match("de_nuke", 1, { kills: 12, deaths: 0 })]);
  assert.equal(agg.kd, 12);
});

test("map stats: grouped, most played first, per-map winrate/KD/ADR", () => {
  const maps = computeMapStats([
    match("de_mirage", 1, { kills: 20, deaths: 10, adr: 90 }),
    match("de_mirage", 0, { kills: 10, deaths: 10, adr: 70 }),
    match("de_dust2", 1, { kills: 15, deaths: 5, adr: 100 }),
  ]);

  assert.equal(maps.length, 2);
  assert.deepEqual(maps[0], {
    map: "de_mirage",
    matches: 2,
    wins: 1,
    winRate: 50,
    kd: 1.5, // 30/20
    adr: 80,
  });
  assert.equal(maps[1]!.map, "de_dust2");
  assert.equal(maps[1]!.kd, 3);
});

test("rangeCutoff: bounded ranges compute from now, all is null", () => {
  const now = new Date("2026-07-03T12:00:00Z");
  assert.equal(rangeCutoff("7d", now)!.toISOString(), "2026-06-26T12:00:00.000Z");
  assert.equal(rangeCutoff("3m", now)!.toISOString(), "2026-04-04T12:00:00.000Z");
  assert.equal(rangeCutoff("all", now), null);
});
