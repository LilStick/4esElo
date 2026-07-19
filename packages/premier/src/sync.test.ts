import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPlayerPremier, type PremierMatchResolver, type PremierSyncStore } from "./sync";
import type { MatchWalker } from "./walk";

const player = (firstSync: boolean) => ({
  id: "p1",
  steamId64: "sid",
  authCode: "auth",
  shareCode: "CSGO-seed",
  firstSync,
});

function fakes(opts: { walked: string[]; ratings?: Record<string, number | null> }) {
  const recorded: number[] = [];
  const state = { cursor: null as string | null, advanced: false };
  const walker: MatchWalker = { nextShareCode: async () => null, walkFrom: async () => opts.walked };
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
      state.advanced = true;
    },
  };
  return { walker, resolver, store, recorded, state };
}

test("firstSync=false : ne résout que les matchs postérieurs (pas le seed)", async () => {
  const f = fakes({
    walked: ["CSGO-1", "CSGO-2"],
    ratings: { "CSGO-seed": 99999, "CSGO-1": 14000, "CSGO-2": 14200 },
  });
  const res = await syncPlayerPremier(player(false), f);
  assert.equal(res.snapshots, 2);
  assert.deepEqual(f.recorded, [14000, 14200]); // seed (99999) PAS résolu
  assert.equal(f.state.cursor, "CSGO-2");
});

test("firstSync=true : résout AUSSI le seed (match d'onboarding)", async () => {
  const f = fakes({ walked: ["CSGO-1"], ratings: { "CSGO-seed": 13900, "CSGO-1": 14000 } });
  const res = await syncPlayerPremier(player(true), f);
  assert.equal(res.snapshots, 2);
  assert.deepEqual(f.recorded, [13900, 14000]); // seed d'abord
  assert.equal(f.state.cursor, "CSGO-1");
});

test("firstSync=true, aucun match plus récent : résout le seed, curseur reste le seed, syncedAt posé", async () => {
  const f = fakes({ walked: [], ratings: { "CSGO-seed": 13900 } });
  const res = await syncPlayerPremier(player(true), f);
  assert.equal(res.snapshots, 1);
  assert.deepEqual(f.recorded, [13900]);
  assert.equal(f.state.cursor, "CSGO-seed"); // inchangé
  assert.equal(f.state.advanced, true); // mais advanceCursor appelé → syncedAt posé
});

test("match irrésolvable (démo expirée) → pas de snapshot, curseur avance quand même", async () => {
  const f = fakes({ walked: ["CSGO-1", "CSGO-2"], ratings: { "CSGO-1": null, "CSGO-2": 15000 } });
  const res = await syncPlayerPremier(player(false), f);
  assert.equal(res.snapshots, 1);
  assert.deepEqual(f.recorded, [15000]);
  assert.equal(f.state.cursor, "CSGO-2");
});

test("firstSync=false, aucun nouveau match → rien, pas d'avancée de curseur", async () => {
  const f = fakes({ walked: [] });
  const res = await syncPlayerPremier(player(false), f);
  assert.equal(res.snapshots, 0);
  assert.equal(f.state.advanced, false);
});
