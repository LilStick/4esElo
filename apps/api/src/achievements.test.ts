import { test } from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, bestEloGainWithin, evaluateAchievements, type AchievementInput } from "./achievements";

function input(over: Partial<AchievementInput> = {}): AchievementInput {
  return {
    matches: 0,
    wins: 0,
    kills: 0,
    aces: 0,
    clutchWins: 0,
    entryWins: 0,
    mvps: 0,
    sniperKills: 0,
    maxElo: 0,
    bestEloGain30d: 0,
    ...over,
  };
}

const byId = (list: ReturnType<typeof evaluateAchievements>, id: string) =>
  list.find((e) => e.def.id === id)!;

test("catalogue : au moins 10 succès, ids uniques", () => {
  assert.ok(ACHIEVEMENTS.length >= 10);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
});

test("joueur vierge : tout verrouillé, progression à 0", () => {
  const out = evaluateAchievements(input());
  assert.equal(out.length, ACHIEVEMENTS.length);
  assert.ok(out.every((e) => !e.unlocked && e.current === 0));
});

test("paliers : débloque au-dessus du seuil, verrouille en dessous, progression exposée", () => {
  const out = evaluateAchievements(input({ matches: 150, wins: 100, aces: 1, maxElo: 2100, clutchWins: 12 }));
  assert.equal(byId(out, "games_100").unlocked, true);
  assert.equal(byId(out, "games_100").current, 150);
  assert.equal(byId(out, "games_500").unlocked, false); // 150 < 500
  assert.equal(byId(out, "wins_100").unlocked, true);
  assert.equal(byId(out, "ace_1").unlocked, true);
  assert.equal(byId(out, "ace_10").unlocked, false);
  assert.equal(byId(out, "elo_2000").unlocked, true);
  assert.equal(byId(out, "clutch_10").unlocked, true);
  assert.equal(byId(out, "clutch_50").unlocked, false);
});

test("bestEloGainWithin : meilleur gain dans la fenêtre, ignore au-delà", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 5, n));
  const points = [
    { elo: 1000, capturedAt: day(1) },
    { elo: 1150, capturedAt: day(20) }, // +150 en 19 j
    { elo: 1250, capturedAt: day(45) }, // +250 depuis day(1) mais 44 j > 30 j
  ];
  const w = 30 * 24 * 3600 * 1000;
  assert.equal(bestEloGainWithin(points, w), 150); // day1→day20 (dans la fenêtre)
  // day20→day45 = +100 en 25 j (dans la fenêtre) ; day1→day45 exclu (>30j)
  assert.equal(bestEloGainWithin([points[0]!, points[2]!], w), 0); // 44 j d'écart → hors fenêtre
});

test("B7.16 : paliers hauts (endgame) verrouillés puis débloqués au seuil", () => {
  // Un gros grinder : débloque les paliers hauts qu'il dépasse, pas les autres.
  const out = evaluateAchievements(input({ matches: 1200, wins: 300, kills: 26000, maxElo: 2600 }));
  assert.equal(byId(out, "games_1000").unlocked, true);
  assert.equal(byId(out, "wins_250").unlocked, true);
  assert.equal(byId(out, "wins_500").unlocked, false); // 300 < 500
  assert.equal(byId(out, "kills_25000").unlocked, true);
  assert.equal(byId(out, "kills_50000").unlocked, false);
  assert.equal(byId(out, "elo_2500").unlocked, true);
  assert.equal(byId(out, "elo_3000").unlocked, false); // 2600 < 3000
});
