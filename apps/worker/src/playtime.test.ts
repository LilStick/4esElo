import { test } from "node:test";
import assert from "node:assert/strict";
import { samplePlaytime, utcDay, type PlaytimeStore } from "./playtime";
import type { SteamPlaytime } from "@4eselo/steam";

const NOW = () => new Date("2026-07-06T14:00:00Z");

function makeStore(lastDays: Record<string, string> = {}) {
  const inserts: { playerId: string; minutes: number | null }[] = [];
  const store: PlaytimeStore & { inserts: typeof inserts } = {
    inserts,
    async getLastCapturedDay(playerId) {
      return lastDays[playerId] ?? null;
    },
    async insertPlaytime(playerId, minutes) {
      inserts.push({ playerId, minutes });
    },
  };
  return store;
}

function makeReader(byId: Record<string, number | null>) {
  const calls: string[][] = [];
  return {
    calls,
    async getPlaytime(ids: string[]): Promise<SteamPlaytime[]> {
      calls.push(ids);
      return ids.map((id) => ({ steamId64: id, minutesForever: byId[id] ?? null }));
    },
  };
}

const p1 = { id: "p1", steamId64: "s1" };
const p2 = { id: "p2", steamId64: "s2" };

test("samples every player once, stores lifetime minutes", async () => {
  const store = makeStore();
  const reader = makeReader({ s1: 81811, s2: 5000 });
  const res = await samplePlaytime(reader, store, [p1, p2], NOW);

  assert.deepEqual(res, { sampled: 2, skipped: 0, failed: 0 });
  assert.deepEqual(store.inserts, [
    { playerId: "p1", minutes: 81811 },
    { playerId: "p2", minutes: 5000 },
  ]);
});

test("dedup: a player already sampled today is skipped, Steam not asked for them", async () => {
  const store = makeStore({ p1: utcDay(NOW()) });
  const reader = makeReader({ s2: 5000 });
  const res = await samplePlaytime(reader, store, [p1, p2], NOW);

  assert.deepEqual(res, { sampled: 1, skipped: 1, failed: 0 });
  assert.deepEqual(reader.calls, [["s2"]]);
});

test("yesterday's sample does not block today's", async () => {
  const store = makeStore({ p1: "2026-07-05" });
  const reader = makeReader({ s1: 81900 });
  const res = await samplePlaytime(reader, store, [p1], NOW);

  assert.equal(res.sampled, 1);
});

test("private profile → a null row is stored (front hint) and counted failed", async () => {
  const store = makeStore();
  const reader = makeReader({ s1: null });
  const res = await samplePlaytime(reader, store, [p1], NOW);

  assert.deepEqual(res, { sampled: 0, skipped: 0, failed: 1 });
  assert.deepEqual(store.inserts, [{ playerId: "p1", minutes: null }]);
});

test("everyone already sampled → zero Steam call", async () => {
  const today = utcDay(NOW());
  const store = makeStore({ p1: today, p2: today });
  const reader = makeReader({});
  const res = await samplePlaytime(reader, store, [p1, p2], NOW);

  assert.deepEqual(res, { sampled: 0, skipped: 2, failed: 0 });
  assert.equal(reader.calls.length, 0);
});
