import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRoast, type FaceitMatchStats } from "@4eselo/types";
import { profileRoast, forecastElo, type RoastProfileInput } from "./roast";

function stats(over: Partial<FaceitMatchStats> = {}): FaceitMatchStats {
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

function profile(over: Partial<RoastProfileInput> = {}): RoastProfileInput {
  return {
    matches: 20,
    avgHs: 45,
    kd: 1,
    adr: 75,
    clutchAttempts: 0,
    clutchWinRate: 0,
    entryAttempts: 0,
    entrySuccessRate: 0,
    currentWinStreak: 0,
    eloDelta30d: null,
    worstMap: null,
    topMap: null,
    ...over,
  };
}

test("matchRoast : ace > carry win > carry loss ; game banale → null", () => {
  assert.equal(matchRoast(stats({ pentaKills: 1 }), 1)!.label, "Ace");
  assert.equal(matchRoast(stats({ kills: 27, deaths: 12 }), 1)!.label, "Patron du lobby");
  assert.equal(matchRoast(stats({ kills: 22, deaths: 20 }), 0)!.label, "Mal entouré");
  assert.equal(matchRoast(stats({ adr: 40, kills: 8, deaths: 12 }), 1)!.label, "Chatouilleur"); // ADR faible même en win
  assert.equal(matchRoast(stats({ kills: 10, deaths: 14 }), 0), null); // défaite banale
});

test("profileRoast : chute libre prioritaire, tri par priorité, max 3", () => {
  const lines = profileRoast(profile({ eloDelta30d: -140, avgHs: 30, matches: 40, kd: 0.7 }));
  assert.ok(lines.length <= 3 && lines.length >= 1);
  assert.equal(lines[0]!.label, "Chute libre"); // prio la plus haute
  assert.ok(lines.some((l) => l.label === "Chasseur de tibias")); // HS < 35
});

test("profileRoast : positif aussi (chirurgien, boucher, en feu)", () => {
  const lines = profileRoast(profile({ avgHs: 60, kd: 1.6, currentWinStreak: 4, matches: 20 }));
  const labels = lines.map((l) => l.label);
  assert.ok(labels.includes("En feu")); // streak ≥ 3, prio haute
  assert.ok(labels.includes("Chirurgien") || labels.includes("Boucher"));
});

test("profileRoast : joueur sans données → aucune punchline", () => {
  assert.deepEqual(profileRoast(profile({ matches: 0, avgHs: 0, kd: 0, adr: 0 })), []);
});

test("forecastElo : tendance montante, < 3 snapshots → null, > 30 j ignoré", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 6, n)); // juillet
  const now = day(30);
  const up = forecastElo(
    [
      { elo: 1500, capturedAt: day(1) },
      { elo: 1560, capturedAt: day(10) },
      { elo: 1620, capturedAt: day(20) },
    ],
    now,
  );
  assert.ok(up && up.perDay > 0 && up.text.includes("📈"));

  assert.equal(forecastElo([{ elo: 1500, capturedAt: day(1) }], now), null); // 1 point
  // tous > 30 j avant `now`
  const old = (n: number) => new Date(Date.UTC(2026, 4, n)); // mai
  assert.equal(
    forecastElo(
      [
        { elo: 1500, capturedAt: old(1) },
        { elo: 1550, capturedAt: old(10) },
        { elo: 1600, capturedAt: old(20) },
      ],
      now,
    ),
    null,
  );
});
