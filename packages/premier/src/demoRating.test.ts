import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRatingAfter, type DemoTickRow } from "./demoRating";

const A = "76561199025088808";
const row = (o: Partial<DemoTickRow>): DemoTickRow => ({
  steamid: A,
  tick: 1,
  rank: 0,
  rank_if_win: 0,
  rank_if_loss: 0,
  rank_if_tie: 0,
  team_num: 2,
  team_rounds_total: 0,
  ...o,
});

test("win → rank_if_win (valeurs réelles d'Arthur : 22672 → 23052)", () => {
  const rows = [
    row({
      tick: 153000,
      rank: 22672,
      rank_if_win: 23052,
      rank_if_loss: 22540,
      rank_if_tie: 22731,
      team_num: 2,
      team_rounds_total: 13,
    }),
    row({ steamid: "opp", tick: 153000, rank: 15000, team_num: 3, team_rounds_total: 8 }),
  ];
  assert.deepEqual(computeRatingAfter(rows, A), { ratingAfter: 23052, result: "win" });
});

test("loss → rank_if_loss", () => {
  const rows = [
    row({
      tick: 100,
      rank: 22672,
      rank_if_win: 23052,
      rank_if_loss: 22540,
      rank_if_tie: 22731,
      team_num: 2,
      team_rounds_total: 6,
    }),
    row({ steamid: "opp", tick: 100, rank: 15000, team_num: 3, team_rounds_total: 13 }),
  ];
  assert.equal(computeRatingAfter(rows, A)!.ratingAfter, 22540);
});

test("égalité → rank_if_tie", () => {
  const rows = [
    row({
      rank: 22672,
      rank_if_win: 23052,
      rank_if_loss: 22540,
      rank_if_tie: 22731,
      team_num: 2,
      team_rounds_total: 12,
    }),
    row({ steamid: "opp", rank: 15000, team_num: 3, team_rounds_total: 12 }),
  ];
  assert.equal(computeRatingAfter(rows, A)!.result, "tie");
});

test("rating < 1000 (Compétitif, tier) → null", () => {
  assert.equal(computeRatingAfter([row({ rank: 13, team_rounds_total: 13 })], A), null);
});

test("joueur absent → null", () => {
  assert.equal(computeRatingAfter([row({ steamid: "someone-else", rank: 20000 })], A), null);
});

test("prend le dernier tick du joueur", () => {
  const rows = [
    row({ tick: 10, rank: 20000, rank_if_win: 20100, team_rounds_total: 13 }),
    row({ tick: 999, rank: 22672, rank_if_win: 23052, team_rounds_total: 13 }),
    row({ steamid: "opp", tick: 999, rank: 15000, team_num: 3, team_rounds_total: 8 }),
  ];
  assert.equal(computeRatingAfter(rows, A)!.ratingAfter, 23052);
});
