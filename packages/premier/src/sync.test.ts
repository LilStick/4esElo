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

const ZERO_STATS = {
  kills: 0,
  deaths: 0,
  assists: 0,
  kd: 0,
  kr: 0,
  adr: 0,
  damage: 0,
  hsPercent: 0,
  rounds: 0,
  mvps: 0,
  doubleKills: 0,
  tripleKills: 0,
  quadroKills: 0,
  pentaKills: 0,
  firstKills: 0,
  firstDeaths: 0,
  utilityDamage: 0,
};

function fakes(opts: { walked: string[]; ratings?: Record<string, number | null>; throwOn?: string }) {
  const recorded: number[] = [];
  const statsRecorded: string[] = [];
  const state = { cursor: null as string | null, advanced: false };
  const walker: MatchWalker = { nextShareCode: async () => null, walkFrom: async () => opts.walked };
  const resolver: PremierMatchResolver = {
    resolve: async (_sid, code) => {
      if (opts.throwOn === code) throw new Error("GC non connecté");
      const r = opts.ratings?.[code];
      return r === null || r === undefined
        ? null
        : {
            ratingAfter: r,
            playedAt: new Date("2026-07-01"),
            map: "de_ancient",
            result: "win",
            myScore: 13,
            oppScore: 5,
            stats: ZERO_STATS,
          };
    },
  };
  const store: PremierSyncStore = {
    recordRating: async (_pid, rating) => {
      recorded.push(rating);
    },
    recordMatchStats: async (_pid, code) => {
      statsRecorded.push(code);
    },
    advanceCursor: async (_pid, code) => {
      state.cursor = code;
      state.advanced = true;
    },
  };
  return { walker, resolver, store, recorded, statsRecorded, state };
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

test("resolve qui plante (GC coupé) → arrêt propre, curseur au dernier traité, rien de sauté", async () => {
  const f = fakes({
    walked: ["CSGO-1", "CSGO-2", "CSGO-3"],
    ratings: { "CSGO-1": 14000 },
    throwOn: "CSGO-2",
  });
  const res = await syncPlayerPremier(player(false), f);
  assert.equal(res.snapshots, 1);
  assert.deepEqual(f.recorded, [14000]);
  assert.equal(f.state.cursor, "CSGO-1"); // avancé au dernier OK, pas au-delà du plantage
});

test("firstSync : seed qui plante d'emblée → aucun curseur posé (seed rejoué au prochain cycle)", async () => {
  const f = fakes({ walked: [], throwOn: "CSGO-seed" });
  const res = await syncPlayerPremier(player(true), f);
  assert.equal(res.snapshots, 0);
  assert.equal(f.state.advanced, false);
});
