import { test } from "node:test";
import assert from "node:assert/strict";
import { FaceitError, type EloHistoryPoint } from "@4eselo/faceit";
import { backfillPlayerElo, type BackfillStore } from "./backfillElo";

const NOW = () => new Date("2026-07-06T18:00:00Z");
const player = { id: "p1", faceitId: "f1" };
const D = (iso: string) => new Date(iso);

function makeStore(init: { attemptedAt?: Date | null; doneAt?: Date | null; earliest?: Date | null } = {}) {
  const calls = {
    attempts: [] as Date[],
    done: [] as Date[],
    matchElos: [] as { matchId: string; elo: number; delta: number | null }[],
    snapshots: [] as { elo: number; level: number; capturedAt: Date }[],
  };
  const store: BackfillStore & { calls: typeof calls } = {
    calls,
    async getBackfillState() {
      return { attemptedAt: init.attemptedAt ?? null, doneAt: init.doneAt ?? null };
    },
    async markAttempt(_id, at) {
      calls.attempts.push(at);
    },
    async markDone(_id, at) {
      calls.done.push(at);
    },
    async setMatchElo(_id, matchId, elo, delta) {
      calls.matchElos.push({ matchId, elo, delta });
    },
    async getEarliestSnapshotAt() {
      return init.earliest ?? null;
    },
    async insertSnapshots(rows) {
      calls.snapshots.push(...rows.map((r) => ({ elo: r.elo, level: r.level, capturedAt: r.capturedAt })));
    },
  };
  return store;
}

const provider = (points: EloHistoryPoint[] | Error) => ({
  async getEloHistory() {
    if (points instanceof Error) throw points;
    return points;
  },
});

test("success: fills matches, rebuilds the retro curve before the live one, marks done", async () => {
  const store = makeStore({ earliest: D("2026-07-02T10:00:00Z") });
  const points: EloHistoryPoint[] = [
    // newest first, as the endpoint returns them
    { matchId: "m3", elo: 1364, eloDelta: -25, date: D("2026-07-03T21:00:00Z") }, // after live start → matches only
    { matchId: "m2", elo: 1389, eloDelta: 25, date: D("2026-06-20T21:00:00Z") },
    { matchId: "m1", elo: 1364, eloDelta: -20, date: D("2026-06-10T21:00:00Z") },
    { matchId: "m0", elo: 1384, eloDelta: null, date: D("2026-05-01T21:00:00Z") },
  ];
  const res = await backfillPlayerElo(provider(points), store, player, NOW);

  assert.deepEqual(res, { status: "ok", matchesFilled: 4, snapshotsInserted: 3 });
  assert.equal(store.calls.matchElos.length, 4);
  assert.deepEqual(store.calls.matchElos[0], { matchId: "m3", elo: 1364, delta: -25 });
  // retro curve: only the 3 points before 2026-07-02, chronological
  assert.deepEqual(
    store.calls.snapshots.map((s) => s.elo),
    [1384, 1364, 1389],
  );
  assert.equal(store.calls.snapshots[0]!.level, 5); // eloToLevel(1384)
  assert.equal(store.calls.done.length, 1);
});

test("change-only dedup on the retro curve (same consecutive elo skipped)", async () => {
  const store = makeStore({ earliest: D("2026-07-02T00:00:00Z") });
  const points: EloHistoryPoint[] = [
    { matchId: "m2", elo: 1500, eloDelta: 0, date: D("2026-06-02T10:00:00Z") },
    { matchId: "m1", elo: 1500, eloDelta: null, date: D("2026-06-01T10:00:00Z") },
  ];
  const res = await backfillPlayerElo(provider(points), store, player, NOW);
  assert.equal(res.status === "ok" && res.snapshotsInserted, 1);
});

test("empty live curve → the whole history becomes the curve", async () => {
  const store = makeStore({ earliest: null });
  const points: EloHistoryPoint[] = [
    { matchId: "m1", elo: 1450, eloDelta: 10, date: D("2026-06-01T10:00:00Z") },
  ];
  const res = await backfillPlayerElo(provider(points), store, player, NOW);
  assert.equal(res.status === "ok" && res.snapshotsInserted, 1);
});

test("already done → no attempt, no calls", async () => {
  const store = makeStore({ doneAt: D("2026-07-05T10:00:00Z") });
  const res = await backfillPlayerElo(provider([]), store, player, NOW);
  assert.deepEqual(res, { status: "done-already" });
  assert.equal(store.calls.attempts.length, 0);
});

test("already attempted today → skip until tomorrow", async () => {
  const store = makeStore({ attemptedAt: D("2026-07-06T03:00:00Z") });
  const res = await backfillPlayerElo(provider([]), store, player, NOW);
  assert.deepEqual(res, { status: "attempted-today" });
  assert.equal(store.calls.attempts.length, 0);
});

test("yesterday's attempt does not block today's", async () => {
  const store = makeStore({ attemptedAt: D("2026-07-05T23:00:00Z") });
  const res = await backfillPlayerElo(provider([]), store, player, NOW);
  assert.equal(res.status, "ok");
});

test("403 → attempt marked (retry tomorrow), nothing written, no throw", async () => {
  const store = makeStore();
  const res = await backfillPlayerElo(provider(new FaceitError(403, "/stats/v1")), store, player, NOW);

  assert.deepEqual(res, { status: "blocked" });
  assert.equal(store.calls.attempts.length, 1);
  assert.equal(store.calls.matchElos.length, 0);
  assert.equal(store.calls.done.length, 0);
});

test("unexpected errors (DB down) are re-thrown", async () => {
  const store = makeStore();
  await assert.rejects(
    () => backfillPlayerElo(provider(new Error("connection refused")), store, player, NOW),
    /connection refused/,
  );
});
