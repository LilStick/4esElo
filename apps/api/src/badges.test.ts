import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBadges, computeBadgeTiers, type BadgeMatch } from "./badges";

const day = (n: number, h = 12) => new Date(Date.UTC(2026, 5, n, h, 0, 0)); // juin
function m(over: Partial<BadgeMatch> = {}): BadgeMatch {
  return {
    playedAt: day(1),
    result: 1,
    hsPercent: 0,
    entryCount: 0,
    entryWins: 0,
    clutchCount: 0,
    clutchWins: 0,
    ...over,
  };
}

test("aucun match → aucun badge", () => {
  assert.deepEqual(computeBadges([]), []);
});

test("🔥 streak : 3 victoires consécutives en cours", () => {
  const ms = [
    m({ playedAt: day(1), result: 0 }),
    m({ playedAt: day(2), result: 1 }),
    m({ playedAt: day(3), result: 1 }),
    m({ playedAt: day(4), result: 1 }),
  ];
  assert.deepEqual(computeBadges(ms), ["streak"]);
});

test("🔥 streak : coupée si le dernier match est une défaite", () => {
  const ms = [
    m({ playedAt: day(1), result: 1 }),
    m({ playedAt: day(2), result: 1 }),
    m({ playedAt: day(3), result: 1 }),
    m({ playedAt: day(4), result: 0 }),
  ];
  assert.deepEqual(computeBadges(ms), []);
});

test("🔥 streak : 2 victoires ne suffisent pas (seuil 3)", () => {
  const ms = [
    m({ playedAt: day(1), result: 0 }),
    m({ playedAt: day(2), result: 1 }),
    m({ playedAt: day(3), result: 1 }),
  ];
  assert.deepEqual(computeBadges(ms), []);
});

test("🎯 headshot : ≥ 10 matchs et HS% moyen ≥ 50", () => {
  // newest (day 10) = défaite → isole le badge HS (pas de streak)
  const ms = Array.from({ length: 10 }, (_, i) =>
    m({ playedAt: day(i + 1), result: i === 9 ? 0 : 1, hsPercent: 55 }),
  );
  assert.deepEqual(computeBadges(ms), ["headshot"]);
});

test("🎯 headshot : HS% élevé mais < 10 matchs → non", () => {
  const ms = Array.from({ length: 9 }, (_, i) =>
    m({ playedAt: day(i + 1), result: i === 8 ? 0 : 1, hsPercent: 80 }),
  );
  assert.deepEqual(computeBadges(ms), []);
});

test("💣 entry : ≥ 20 duels et ≥ 55% gagnés", () => {
  const ms = [m({ playedAt: day(1), result: 0, entryCount: 20, entryWins: 11 })];
  assert.deepEqual(computeBadges(ms), ["entry"]);
});

test("💣 entry : taux ok mais trop peu de duels → non", () => {
  const ms = [m({ playedAt: day(1), result: 0, entryCount: 10, entryWins: 10 })];
  assert.deepEqual(computeBadges(ms), []);
});

test("🧠 clutch : ≥ 10 clutchs et ≥ 50% gagnés", () => {
  const ms = [m({ playedAt: day(1), result: 0, clutchCount: 10, clutchWins: 5 })];
  assert.deepEqual(computeBadges(ms), ["clutch"]);
});

test("🧠 clutch : sous le seuil de tentatives → non", () => {
  const ms = [m({ playedAt: day(1), result: 0, clutchCount: 4, clutchWins: 4 })];
  assert.deepEqual(computeBadges(ms), []);
});

test("🚿 grind : ≥ 6 matchs sur une même journée UTC", () => {
  const ms = Array.from({ length: 6 }, (_, i) => m({ playedAt: day(3, i), result: i % 2 }));
  assert.deepEqual(computeBadges(ms), ["grind"]);
});

test("🚿 grind : 6 matchs mais sur des jours différents → non", () => {
  const ms = Array.from({ length: 6 }, (_, i) => m({ playedAt: day(i + 1), result: i % 2 }));
  assert.deepEqual(computeBadges(ms), []);
});

test("badges cumulables (streak + headshot + grind)", () => {
  const ms = Array.from({ length: 10 }, (_, i) =>
    m({ playedAt: i < 6 ? day(5, i) : day(10 + i), result: 1, hsPercent: 60 }),
  );
  const out = computeBadges(ms);
  assert.ok(out.includes("streak"));
  assert.ok(out.includes("headshot"));
  assert.ok(out.includes("grind"));
});

// --- B5.13 : badges à paliers (computeBadgeTiers) ---

const tier = (ts: ReturnType<typeof computeBadgeTiers>, id: string) => ts.find((t) => t.id === id);

test("tiers : aucun match → aucun badge", () => {
  assert.deepEqual(computeBadgeTiers([]), []);
});

test("tiers : 🔥 6 victoires d'affilée → count 2 + message", () => {
  const ms = [1, 2, 3, 4, 5, 6].map((n) => m({ playedAt: day(n), result: 1 }));
  const streak = tier(computeBadgeTiers(ms), "streak");
  assert.equal(streak?.count, 2); // floor(6/3)
  assert.equal(streak?.emoji, "🔥");
  assert.match(streak?.message ?? "", /6 victoires/);
});

test("tiers : 😰 série de défaites (badge négatif)", () => {
  const ms = [1, 2, 3].map((n) => m({ playedAt: day(n), result: 0 }));
  const cold = tier(computeBadgeTiers(ms), "coldstreak");
  assert.equal(cold?.count, 1);
  assert.equal(cold?.emoji, "😰");
});

test("tiers : 🚿 grind à paliers sur la journée (4 matchs → count 2)", () => {
  const ms = [
    m({ playedAt: day(5, 10), result: 1 }),
    m({ playedAt: day(5, 12), result: 0 }),
    m({ playedAt: day(5, 14), result: 1 }),
    m({ playedAt: day(5, 16), result: 0 }),
  ];
  const grind = tier(computeBadgeTiers(ms), "grind");
  assert.equal(grind?.count, 2); // floor(4/2)
  assert.match(grind?.message ?? "", /4 matchs/);
});

test("tiers : 🎯 HS% par bandes (≥60 → count 2) + min-samples", () => {
  // 6 matchs sur des jours distincts (pas de grind), résultats alternés (pas de streak).
  const hi = [1, 2, 3, 4, 5, 6].map((n) => m({ playedAt: day(n), result: n % 2, hsPercent: 62 }));
  assert.equal(tier(computeBadgeTiers(hi), "headshot")?.count, 2);
  // Sous le min d'échantillon (4 < 5) → pas de badge HS.
  const few = [1, 2, 3, 4].map((n) => m({ playedAt: day(n), result: n % 2, hsPercent: 62 }));
  assert.equal(tier(computeBadgeTiers(few), "headshot"), undefined);
});
