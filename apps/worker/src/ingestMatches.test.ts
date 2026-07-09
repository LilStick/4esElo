import { test } from "node:test";
import assert from "node:assert/strict";
import { FaceitError, FaceitNotFoundError, type FaceitMatchDetail } from "@4eselo/faceit";
import { ingestMatches, type MatchLevelStore, type MatchToBackfill } from "./ingestMatches";

const noSleep = async () => {};

function detail(matchId: string): FaceitMatchDetail {
  return {
    matchId,
    map: "de_mirage",
    players: [],
    teams: [
      { teamId: "faction1", score: 13, playerIds: ["a", "b"] },
      { teamId: "faction2", score: 8, playerIds: ["c", "d"] },
    ],
    winnerTeamId: "faction1",
  };
}

function makeStore(todo: MatchToBackfill[]) {
  const inserted: Parameters<MatchLevelStore["insertMatch"]>[0][] = [];
  const store: MatchLevelStore = {
    async getMatchesToBackfill() {
      return todo;
    },
    async insertMatch(row) {
      inserted.push(row);
    },
  };
  return { store, inserted };
}

test("ingestMatches insère les matchs manquants avec compo + score + date", async () => {
  const { store, inserted } = makeStore([
    { matchId: "m1", playedAt: new Date("2026-06-01T20:00:00Z") },
    { matchId: "m2", playedAt: new Date("2026-06-02T20:00:00Z") },
  ]);
  const reader = { getMatchStats: async (id: string) => detail(id) };

  const res = await ingestMatches(reader, store, { sleep: noSleep });
  assert.equal(res.inserted, 2);
  assert.equal(res.failed, 0);
  assert.equal(inserted.length, 2);
  assert.equal(inserted[0]!.matchId, "m1");
  assert.equal(inserted[0]!.winnerTeamId, "faction1");
  assert.deepEqual(inserted[0]!.teams[0], { teamId: "faction1", score: 13, playerIds: ["a", "b"] });
  assert.deepEqual(inserted[0]!.playedAt, new Date("2026-06-01T20:00:00Z"));
});

test("ingestMatches : détail null → failed, on continue avec les suivants", async () => {
  const { store, inserted } = makeStore([
    { matchId: "gone", playedAt: new Date("2026-06-01T20:00:00Z") },
    { matchId: "ok", playedAt: new Date("2026-06-02T20:00:00Z") },
  ]);
  const reader = {
    getMatchStats: async (id: string): Promise<FaceitMatchDetail | null> =>
      id === "gone" ? null : detail(id),
  };

  const res = await ingestMatches(reader, store, { sleep: noSleep });
  assert.equal(res.inserted, 1);
  assert.equal(res.failed, 1);
  assert.equal(inserted[0]!.matchId, "ok");
});

test("ingestMatches : 404 sauté ; erreur transitoire → arrêt (retry au prochain run)", async () => {
  const { store, inserted } = makeStore([
    { matchId: "a-404", playedAt: new Date("2026-06-01T00:00:00Z") },
    { matchId: "b-500", playedAt: new Date("2026-06-02T00:00:00Z") },
    { matchId: "c-after", playedAt: new Date("2026-06-03T00:00:00Z") },
  ]);
  const reader = {
    getMatchStats: async (id: string): Promise<FaceitMatchDetail | null> => {
      if (id === "a-404") throw new FaceitNotFoundError(404, "/matches");
      if (id === "b-500") throw new FaceitError(500, "/matches");
      return detail(id);
    },
  };

  const res = await ingestMatches(reader, store, { sleep: noSleep });
  assert.equal(res.failed, 2); // 404 + 500
  assert.equal(res.inserted, 0); // c-after jamais atteint (break sur le 500)
  assert.equal(inserted.length, 0);
});
