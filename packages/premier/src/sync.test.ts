import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPlayerPremier, type PremierMatchResolver, type PremierSyncStore } from "./sync";
import type { MatchWalker } from "./walk";

const PLAYER = { id: "p1", steamId64: "sid", authCode: "auth", shareCode: "CSGO-seed" };

function fakes(opts: { codes: string[]; ratings?: Record<string, number | null> }) {
  const recorded: number[] = [];
  const state = { cursor: null as string | null };
  const walker: MatchWalker = { nextShareCode: async () => null, walkFrom: async () => opts.codes };
  const resolver: PremierMatchResolver = {
    resolve: async (_sid, code) => {
      const r = opts.ratings?.[code];
      return r === null || r === undefined ? null : { ratingAfter: r, playedAt: new Date("2026-07-01") };
    },
  };
  const store: PremierSyncStore = {
    recordRating: async (_pid, rating) => {
      recorded.push(rating);
    },
    advanceCursor: async (_pid, code) => {
      state.cursor = code;
    },
  };
  return { walker, resolver, store, recorded, state };
}

test("sync : chaque match résolu → un snapshot, curseur au dernier code", async () => {
  const f = fakes({ codes: ["CSGO-1", "CSGO-2"], ratings: { "CSGO-1": 14000, "CSGO-2": 14200 } });
  const res = await syncPlayerPremier(PLAYER, f);
  assert.equal(res.newMatches, 2);
  assert.equal(res.snapshots, 2);
  assert.deepEqual(f.recorded, [14000, 14200]);
  assert.equal(f.state.cursor, "CSGO-2");
});

test("sync : match irrésolvable (démo expirée) → pas de snapshot, curseur avance quand même", async () => {
  const f = fakes({ codes: ["CSGO-1", "CSGO-2"], ratings: { "CSGO-1": null, "CSGO-2": 15000 } });
  const res = await syncPlayerPremier(PLAYER, f);
  assert.equal(res.snapshots, 1);
  assert.deepEqual(f.recorded, [15000]);
  assert.equal(f.state.cursor, "CSGO-2");
});

test("sync : aucun nouveau match → rien, curseur inchangé", async () => {
  const f = fakes({ codes: [] });
  const res = await syncPlayerPremier(PLAYER, f);
  assert.equal(res.newMatches, 0);
  assert.equal(res.snapshots, 0);
  assert.equal(f.state.cursor, null);
});
