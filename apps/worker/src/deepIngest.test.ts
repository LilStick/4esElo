import { test } from "node:test";
import assert from "node:assert/strict";
import type { MatchReader, MatchStatsStore } from "./ingest";
import { deepIngestPlayers, type DeepIngestStore } from "./deepIngest";

const noSleep = async () => {};

test("deepIngestPlayers : deep-ingère un joueur non marqué puis le marque", async () => {
  const marked: string[] = [];
  // Historique vide → ingestPlayerMatches ne fait rien, mais le joueur doit être marqué.
  const reader: MatchReader = {
    async getMatchHistory() {
      return [];
    },
    async getMatchStats() {
      return null;
    },
  };
  const matchStore: MatchStatsStore = {
    async getStoredMatchIds() {
      return new Set();
    },
    async insertMatchStats() {},
  };
  const deepStore: DeepIngestStore = {
    async getPlayersNeedingDeepIngest(limit) {
      return [{ id: "p1", faceitId: "fc-1" }].slice(0, limit);
    },
    async markDeepIngested(id) {
      marked.push(id);
    },
  };

  const res = await deepIngestPlayers(reader, matchStore, deepStore, { sleep: noSleep });
  assert.equal(res.players, 1);
  assert.deepEqual(marked, ["p1"]);
});

test("deepIngestPlayers : aucun joueur à traiter → no-op, ne marque rien", async () => {
  const deepStore: DeepIngestStore = {
    async getPlayersNeedingDeepIngest() {
      return [];
    },
    async markDeepIngested() {
      throw new Error("ne devrait pas être appelé");
    },
  };
  const reader: MatchReader = {
    async getMatchHistory() {
      return [];
    },
    async getMatchStats() {
      return null;
    },
  };
  const matchStore: MatchStatsStore = {
    async getStoredMatchIds() {
      return new Set();
    },
    async insertMatchStats() {},
  };

  const res = await deepIngestPlayers(reader, matchStore, deepStore, { sleep: noSleep });
  assert.deepEqual(res, { players: 0, inserted: 0 });
});
