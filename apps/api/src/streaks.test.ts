import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak, computeOvertakeEvents, type OvertakeInput } from "./streaks";

test("streak: aucun match → current null, records à 0", () => {
  assert.deepEqual(computeStreak([]), { current: null, bestWinStreak: 0, worstLossStreak: 0 });
});

test("streak: série de wins en cours + records sur tout l'historique", () => {
  // newest first : 3 wins, puis 2 losses, puis 4 wins
  const res = computeStreak([1, 1, 1, 0, 0, 1, 1, 1, 1]);
  assert.deepEqual(res.current, { type: "win", length: 3 });
  assert.equal(res.bestWinStreak, 4); // la vieille série de 4 reste le record
  assert.equal(res.worstLossStreak, 2);
});

test("streak: série de losses en cours", () => {
  const res = computeStreak([0, 0, 0, 0, 1]);
  assert.deepEqual(res.current, { type: "loss", length: 4 });
  assert.equal(res.bestWinStreak, 1);
  assert.equal(res.worstLossStreak, 4);
});

test("streak: un seul match", () => {
  assert.deepEqual(computeStreak([1]), {
    current: { type: "win", length: 1 },
    bestWinStreak: 1,
    worstLossStreak: 0,
  });
});

function p(
  id: string,
  elo: number | null,
  baselineElo: number | null,
  history: { at: number; elo: number }[] = [],
): OvertakeInput {
  return {
    id,
    discordId: null,
    faceitNickname: id,
    discordName: null,
    discordAvatar: null,
    elo,
    baselineElo,
    history,
  };
}

test("overtakes: un croisement dans la fenêtre = 1 event horodaté", () => {
  // a démarre au-dessus (1200 vs 1000), b monte à 1250 à t=100 → b passe a.
  const out = computeOvertakeEvents([p("a", 1200, 1200), p("b", 1250, 1000, [{ at: 100, elo: 1250 }])]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.passer.id, "b");
  assert.equal(out[0]!.passed.id, "a");
  assert.equal(out[0]!.at, new Date(100).toISOString());
});

test("overtakes: aucun croisement (ordre inchangé) → vide", () => {
  assert.deepEqual(computeOvertakeEvents([p("a", 1300, 1200), p("b", 1100, 1000)]), []);
});

test("overtakes: joueur sans baseline (arrivé en cours) → paire ignorée", () => {
  assert.deepEqual(computeOvertakeEvents([p("a", 1100, 1200), p("x", 1500, null)]), []);
});

test("overtakes: re-dépassement = 2 events, le plus récent d'abord", () => {
  // b au-dessus au départ ; a passe à t=100, b repasse à t=200.
  const out = computeOvertakeEvents([
    p("a", 1200, 1000, [{ at: 100, elo: 1200 }]),
    p("b", 1300, 1100, [{ at: 200, elo: 1300 }]),
  ]);
  assert.deepEqual(
    out.map((o) => `${o.passer.id}>${o.passed.id}@${new Date(o.at).getTime()}`),
    ["b>a@200", "a>b@100"],
  );
});
