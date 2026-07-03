import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FaceitError,
  FaceitNotFoundError,
  type FaceitMatchRef,
  type FaceitMatchDetail,
} from "@4eselo/faceit";
import type { FaceitMatchStats } from "@4eselo/types";
import { ingestPlayerMatches, type MatchReader, type MatchStatsStore } from "./ingest";

const NOW = new Date("2026-07-03T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const player = { id: "p-1", faceitId: "fc-1" };

/** Match refs m1 (newest) → mN (oldest), one per day. */
function makeRefs(count: number, opts: { startDaysAgo?: number } = {}): FaceitMatchRef[] {
  const startDaysAgo = opts.startDaysAgo ?? 1;
  return Array.from({ length: count }, (_, i) => {
    const started = new Date(NOW.getTime() - (startDaysAgo + i) * DAY);
    return {
      matchId: `m${i + 1}`,
      startedAt: started,
      finishedAt: new Date(started.getTime() + 40 * 60 * 1000),
    };
  });
}

const emptyStats = {} as FaceitMatchStats;

function makeDetail(matchId: string, extra: Partial<FaceitMatchDetail> = {}): FaceitMatchDetail {
  return {
    matchId,
    map: "de_mirage",
    players: [
      { playerId: "fc-1", nickname: "noe", result: 1, stats: { ...emptyStats, kills: 20 } },
      { playerId: "fc-2", nickname: "mate", result: 1, stats: { ...emptyStats, kills: 5 } },
    ],
    ...extra,
  };
}

/** Reader over a fixed history; records calls, supports per-match failures. */
function makeReader(
  refs: FaceitMatchRef[],
  opts: { failStats?: Record<string, Error>; detailFor?: (id: string) => FaceitMatchDetail | null } = {},
): MatchReader & { historyCalls: number[]; statsCalls: string[] } {
  const historyCalls: number[] = [];
  const statsCalls: string[] = [];
  return {
    historyCalls,
    statsCalls,
    async getMatchHistory(_id, { limit, offset }) {
      historyCalls.push(offset);
      return refs.slice(offset, offset + limit);
    },
    async getMatchStats(matchId) {
      statsCalls.push(matchId);
      const err = opts.failStats?.[matchId];
      if (err) throw err;
      return opts.detailFor ? opts.detailFor(matchId) : makeDetail(matchId);
    },
  };
}

function makeStore(stored: string[] = []): MatchStatsStore & { inserts: { matchId: string }[] } {
  const inserts: { matchId: string; playedAt: Date; result: number }[] = [];
  const storedSet = new Set(stored);
  return {
    inserts,
    async getStoredMatchIds(_playerId, matchIds) {
      return new Set(matchIds.filter((id) => storedSet.has(id)));
    },
    async insertMatchStats(row) {
      inserts.push(row);
      storedSet.add(row.matchId);
    },
  };
}

const noSleep = { sleep: async () => {}, now: () => NOW };

test("backfill: empty store → every match in the window is inserted, oldest first", async () => {
  const reader = makeReader(makeRefs(5));
  const store = makeStore();
  const res = await ingestPlayerMatches(reader, store, player, noSleep);

  assert.deepEqual(res, {
    scanned: 5,
    inserted: 5,
    skipped: 0,
    failed: 0,
    insertedMatchIds: ["m5", "m4", "m3", "m2", "m1"],
  });
  assert.deepEqual(
    store.inserts.map((r) => r.matchId),
    ["m5", "m4", "m3", "m2", "m1"],
  );
});

test("inserted row carries THIS member's stats, map, result and playedAt", async () => {
  const reader = makeReader(makeRefs(1));
  const store = makeStore();
  await ingestPlayerMatches(reader, store, player, noSleep);

  const row = store.inserts[0] as {
    matchId: string;
    playerId: string;
    map: string;
    result: number;
    eloAfter: number | null;
    stats: FaceitMatchStats;
  };
  assert.equal(row.playerId, "p-1");
  assert.equal(row.map, "de_mirage");
  assert.equal(row.result, 1);
  assert.equal(row.eloAfter, null);
  assert.equal(row.stats.kills, 20); // fc-1's line, not fc-2's
});

test("dedup: already-stored matches are skipped, only new ones fetched", async () => {
  const reader = makeReader(makeRefs(4));
  const store = makeStore(["m2", "m4"]);
  const res = await ingestPlayerMatches(reader, store, player, noSleep);

  assert.deepEqual(res, {
    scanned: 4,
    inserted: 2,
    skipped: 2,
    failed: 0,
    insertedMatchIds: ["m3", "m1"],
  });
  assert.deepEqual(reader.statsCalls.sort(), ["m1", "m3"]);
});

test("window: matches older than windowDays are ignored", async () => {
  // m1-m3 recent, m4-m5 beyond the 90-day window
  const refs = [
    ...makeRefs(3),
    ...makeRefs(2, { startDaysAgo: 95 }).map((r, i) => ({ ...r, matchId: `old${i + 1}` })),
  ];
  const reader = makeReader(refs);
  const store = makeStore();
  const res = await ingestPlayerMatches(reader, store, player, { ...noSleep, windowDays: 90 });

  assert.equal(res.scanned, 3);
  assert.equal(res.inserted, 3);
  assert.ok(!reader.statsCalls.some((id) => id.startsWith("old")));
});

test("maxMatches caps the run", async () => {
  const reader = makeReader(makeRefs(30));
  const store = makeStore();
  const res = await ingestPlayerMatches(reader, store, player, {
    ...noSleep,
    pageSize: 10,
    maxMatches: 15,
  });

  assert.equal(res.scanned, 15);
  assert.equal(res.inserted, 15);
});

test("incremental early-stop: first page fully stored → a single history call, no stats calls", async () => {
  const refs = makeRefs(60);
  const reader = makeReader(refs);
  const store = makeStore(refs.map((r) => r.matchId));
  const res = await ingestPlayerMatches(reader, store, player, { ...noSleep, pageSize: 50 });

  assert.deepEqual(reader.historyCalls, [0]);
  assert.equal(reader.statsCalls.length, 0);
  assert.equal(res.inserted, 0);
  assert.equal(res.skipped, 50);
});

test("stats permanently missing (404) → counted failed, newer matches still inserted", async () => {
  const reader = makeReader(makeRefs(3), {
    failStats: { m2: new FaceitNotFoundError(404, "/matches/m2/stats") },
  });
  const store = makeStore();
  const res = await ingestPlayerMatches(reader, store, player, noSleep);

  assert.deepEqual(res, {
    scanned: 3,
    inserted: 2,
    skipped: 0,
    failed: 1,
    insertedMatchIds: ["m3", "m1"],
  });
  assert.deepEqual(
    store.inserts.map((r) => r.matchId),
    ["m3", "m1"],
  );
});

test("transient failure (5xx) → stop there so the next run retries this match and newer ones", async () => {
  const reader = makeReader(makeRefs(3), {
    failStats: { m2: new FaceitError(503, "/matches/m2/stats") },
  });
  const store = makeStore();
  const res = await ingestPlayerMatches(reader, store, player, noSleep);

  // oldest-first: m3 inserted, m2 fails transiently, m1 NOT attempted
  assert.deepEqual(res, {
    scanned: 3,
    inserted: 1,
    skipped: 0,
    failed: 1,
    insertedMatchIds: ["m3"],
  });
  assert.deepEqual(
    store.inserts.map((r) => r.matchId),
    ["m3"],
  );
  assert.ok(!reader.statsCalls.includes("m1"));
});

test("member missing from the match detail → failed, no insert, run continues", async () => {
  const reader = makeReader(makeRefs(2), {
    detailFor: (id) => (id === "m1" ? makeDetail(id, { players: [] }) : makeDetail(id)),
  });
  const store = makeStore();
  const res = await ingestPlayerMatches(reader, store, player, noSleep);

  assert.deepEqual(res, {
    scanned: 2,
    inserted: 1,
    skipped: 0,
    failed: 1,
    insertedMatchIds: ["m2"],
  });
});

test("throttle: sleeps between Faceit calls", async () => {
  let sleeps = 0;
  const reader = makeReader(makeRefs(3));
  const store = makeStore();
  await ingestPlayerMatches(reader, store, player, {
    now: () => NOW,
    sleep: async () => {
      sleeps += 1;
    },
  });

  assert.equal(sleeps, 3); // one per stats call (single history page → no page sleep)
});

test("unexpected errors (DB down) are re-thrown, not absorbed", async () => {
  const reader = makeReader(makeRefs(1));
  const store = makeStore();
  store.insertMatchStats = async () => {
    throw new Error("connection refused");
  };
  await assert.rejects(() => ingestPlayerMatches(reader, store, player, noSleep), /connection refused/);
});
