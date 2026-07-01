import { test } from "node:test";
import assert from "node:assert/strict";
import { FaceitNotFoundError, type FaceitPlayer } from "@4eselo/faceit";
import { syncPlayer, type FaceitReader, type SnapshotStore } from "./sync";

function makeProfile(elo: number | null): FaceitPlayer {
  return {
    playerId: "fc-1",
    nickname: "noe",
    avatar: null,
    country: "fr",
    cs2: elo === null ? null : { elo, skillLevel: 8, steamId64: "765..." },
  };
}

/** In-memory store that records inserts, so we can assert on them. */
function makeStore(latest: number | null): SnapshotStore & { inserts: unknown[] } {
  const inserts: unknown[] = [];
  return {
    inserts,
    getLatestElo: async () => latest,
    insertSnapshot: async (input) => {
      inserts.push(input);
    },
  };
}

const reader = (profile: FaceitPlayer | (() => Promise<never>)): FaceitReader => ({
  getPlayerById: typeof profile === "function" ? profile : async () => profile,
});

const player = { id: "p-1", faceitId: "fc-1" };

test("records a snapshot when ELO changed", async () => {
  const store = makeStore(1800);
  const res = await syncPlayer(reader(makeProfile(1875)), store, player);

  assert.deepEqual(res, { status: "recorded", elo: 1875, previous: 1800, level: 8 });
  assert.equal(store.inserts.length, 1);
  assert.deepEqual(store.inserts[0], {
    playerId: "p-1",
    source: "faceit",
    elo: 1875,
    level: 8,
  });
});

test("records the first-ever snapshot when there is no history", async () => {
  const store = makeStore(null);
  const res = await syncPlayer(reader(makeProfile(1500)), store, player);

  assert.equal(res.status, "recorded");
  assert.equal(store.inserts.length, 1);
});

test("does NOT insert when ELO is unchanged", async () => {
  const store = makeStore(1875);
  const res = await syncPlayer(reader(makeProfile(1875)), store, player);

  assert.deepEqual(res, { status: "unchanged", elo: 1875 });
  assert.equal(store.inserts.length, 0);
});

test("returns no-cs2 and inserts nothing when the player never played CS2", async () => {
  const store = makeStore(null);
  const res = await syncPlayer(reader(makeProfile(null)), store, player);

  assert.deepEqual(res, { status: "no-cs2" });
  assert.equal(store.inserts.length, 0);
});

test("returns not-found when Faceit 404s", async () => {
  const store = makeStore(null);
  const throwing = async () => {
    throw new FaceitNotFoundError(404, "/players/fc-1");
  };
  const res = await syncPlayer(reader(throwing), store, player);

  assert.deepEqual(res, { status: "not-found" });
  assert.equal(store.inserts.length, 0);
});

test("re-throws unexpected errors (e.g. API down) so the runner can log them", async () => {
  const store = makeStore(null);
  const boom = async () => {
    throw new Error("500 upstream");
  };
  await assert.rejects(() => syncPlayer(reader(boom), store, player), /500 upstream/);
});
