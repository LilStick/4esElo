import { test } from "node:test";
import assert from "node:assert/strict";
import { hltvRating, type FaceitMatchStats } from "@4eselo/types";
import {
  computeAggregate,
  computeMapStats,
  computeMapLeaderboard,
  percentile,
  rangeCutoff,
  type MatchForStats,
} from "./stats";

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
    rating: null,
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

test("hltvRating: bonne game > 1, sans rounds → null (B16.8)", () => {
  const r = hltvRating({
    kills: 20,
    deaths: 10,
    rounds: 24,
    doubleKills: 2,
    tripleKills: 1,
    quadroKills: 0,
    pentaKills: 0,
  });
  assert.ok(r !== null && Math.abs(r - 1.29) < 0.03, `attendu ~1.29, obtenu ${r}`);
  // partie médiocre → sous 1
  const bad = hltvRating({
    kills: 8,
    deaths: 20,
    rounds: 24,
    doubleKills: 0,
    tripleKills: 0,
    quadroKills: 0,
    pentaKills: 0,
  });
  assert.ok(bad !== null && bad < 1, `attendu < 1, obtenu ${bad}`);
  assert.equal(
    hltvRating({
      kills: 20,
      deaths: 10,
      rounds: 0,
      doubleKills: 0,
      tripleKills: 0,
      quadroKills: 0,
      pentaKills: 0,
    }),
    null,
  );
});

test("aggregate: rating HLTV agrégé sur les totaux (rounds via kr), null si aucun round", () => {
  // 2 matchs, kr fixé → rounds dérivés (24 + 20 = 44 rounds).
  const agg = computeAggregate("all", [
    match("de_mirage", 1, { kills: 24, deaths: 15, kr: 1.0, doubleKills: 3 }),
    match("de_dust2", 0, { kills: 14, deaths: 20, kr: 0.7, doubleKills: 1 }),
  ]);
  assert.equal(typeof agg.rating, "number");
  assert.ok(agg.rating! > 0);

  // aucun match / kr=0 partout → pas de rounds → rating null
  assert.equal(computeAggregate("all", []).rating, null);
  assert.equal(computeAggregate("all", [match("de_x", 1, { kills: 10, kr: 0 })]).rating, null);
});

test("map leaderboard: par map, classé par winrate, seuil de games (B13.6)", () => {
  const players = [
    { id: "p1", nickname: "alice", discordId: null, discordAvatar: null },
    { id: "p2", nickname: "bob", discordId: null, discordAvatar: null },
  ];
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => ({
      playerId: "p1",
      map: "de_mirage",
      result: i < 4 ? 1 : 0,
      kills: 20,
      deaths: 10,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      playerId: "p2",
      map: "de_mirage",
      result: i < 2 ? 1 : 0,
      kills: 15,
      deaths: 15,
    })),
    ...Array.from({ length: 3 }, () => ({
      playerId: "p2",
      map: "de_dust2",
      result: 1,
      kills: 10,
      deaths: 10,
    })),
  ];
  const lb = computeMapLeaderboard(players, rows, 5);
  assert.equal(lb.length, 1); // dust2 exclu (p2 n'a que 3 games < 5)
  assert.equal(lb[0]!.map, "de_mirage");
  assert.equal(lb[0]!.players.length, 2);
  assert.equal(lb[0]!.players[0]!.player.nickname, "alice"); // 80% en tête
  assert.equal(lb[0]!.players[0]!.winRate, 80);
  assert.equal(lb[0]!.players[0]!.kd, 2); // 100 kills / 50 deaths
  assert.equal(lb[0]!.players[1]!.player.nickname, "bob"); // 40%
});

test("percentile : médiane, extrêmes, ex æquo, échantillon vide", () => {
  const sample = [10, 20, 30, 40, 50];
  // La médiane (30) est ≤ à 3 des 5 valeurs → 60%.
  assert.equal(percentile(30, sample), 60);
  // Le max est ≤ à tout l'échantillon → 100% ; en dessous de tout → 20% (lui-même compté s'il est dedans).
  assert.equal(percentile(50, sample), 100);
  assert.equal(percentile(10, sample), 20);
  // Sous le minimum → 0%.
  assert.equal(percentile(5, sample), 0);
  // Ex æquo : tous à 30, une valeur de 30 est ≤ à toutes → 100%.
  assert.equal(percentile(30, [30, 30, 30]), 100);
  // Échantillon vide → 0, jamais de division par zéro.
  assert.equal(percentile(42, []), 0);
});
