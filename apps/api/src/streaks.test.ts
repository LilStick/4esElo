import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak, computeOvertakes, type OvertakeInput } from "./streaks";

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

function p(id: string, elo: number | null, baselineElo: number | null): OvertakeInput {
  return { id, faceitNickname: id, discordName: null, discordAvatar: null, elo, baselineElo };
}

test("overtakes: B passe devant A quand les ELO se croisent", () => {
  const out = computeOvertakes([p("a", 1100, 1200), p("b", 1150, 1000)]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.passer.id, "b");
  assert.equal(out[0]!.passed.id, "a");
});

test("overtakes: pas de croisement → vide", () => {
  assert.deepEqual(computeOvertakes([p("a", 1300, 1200), p("b", 1100, 1000)]), []);
});

test("overtakes: joueur sans baseline (arrivé en cours de fenêtre) ignoré", () => {
  const out = computeOvertakes([p("a", 1100, 1200), p("nouveau", 1500, null)]);
  assert.deepEqual(out, []);
});

test("overtakes: un joueur peut en dépasser plusieurs, triés par rang actuel", () => {
  const out = computeOvertakes([p("a", 1000, 1300), p("b", 1010, 1200), p("c", 1400, 1100)]);
  // c passe devant a et b ; b (1010) finit aussi devant a (1000) alors qu'il partait derrière
  assert.deepEqual(
    out.map((o) => `${o.passer.id}>${o.passed.id}`),
    ["c>a", "c>b", "b>a"],
  );
});
