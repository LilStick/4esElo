import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractMatchInfo,
  decodeMatchId,
  matchListMatchId,
  isStaleMatchList,
  createTimeoutTracker,
} from "./gcBot";

// Share code valide (25 chars du dico, sans I ni l) → matchId déterministe.
const SHARE = "CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ";

// --- extractMatchInfo ------------------------------------------------------

test("extractMatchInfo : match nominal → demoUrl + gameType + playedAt", () => {
  const info = extractMatchInfo([
    {
      roundstatsall: [{ map: "http://x/003abc.dem.bz2" }, { reservation: { game_type: 2 } }],
      matchtime: 1_700_000_000,
    },
  ]);
  assert.equal(info.demoUrl, "http://x/003abc.dem.bz2");
  assert.equal(info.gameType, 2);
  assert.equal(info.playedAt?.getTime(), 1_700_000_000 * 1000);
});

test("extractMatchInfo : tableau vide → tout null", () => {
  assert.deepEqual(extractMatchInfo([]), { demoUrl: null, gameType: null, playedAt: null });
});

test("extractMatchInfo : aucune URL .dem → demoUrl null", () => {
  const info = extractMatchInfo([{ roundstatsall: [{ map: "de_mirage" }] }]);
  assert.equal(info.demoUrl, null);
});

test("extractMatchInfo : game_type non-number / matchtime absent → null", () => {
  const info = extractMatchInfo([{ roundstatsall: [{ reservation: { game_type: "x" } }] }]);
  assert.equal(info.gameType, null);
  assert.equal(info.playedAt, null);
});

test("extractMatchInfo : non-tableau → tout null", () => {
  assert.deepEqual(extractMatchInfo(undefined), { demoUrl: null, gameType: null, playedAt: null });
});

// --- corrélation matchid (anti-race matchList) -----------------------------

test("decodeMatchId : share code valide → bigint ; invalide → null", () => {
  assert.equal(typeof decodeMatchId(SHARE), "bigint");
  assert.equal(decodeMatchId("pas-un-code"), null);
});

test("matchListMatchId : lit m.matchid (string/number) ; absent → null", () => {
  assert.equal(matchListMatchId([{ matchid: "12345" }]), 12345n);
  assert.equal(matchListMatchId([{ matchid: 42 }]), 42n);
  assert.equal(matchListMatchId([{}]), null);
  assert.equal(matchListMatchId([]), null);
});

test("isStaleMatchList : matchid différent → périmé (ignoré)", () => {
  const expected = decodeMatchId(SHARE)!;
  assert.equal(isStaleMatchList(expected, [{ matchid: String(expected + 1n) }]), true);
});

test("isStaleMatchList : même matchid → pas périmé", () => {
  const expected = decodeMatchId(SHARE)!;
  assert.equal(isStaleMatchList(expected, [{ matchid: String(expected) }]), false);
});

test("isStaleMatchList : un matchid illisible → on n'exclut pas (défensif)", () => {
  const expected = decodeMatchId(SHARE)!;
  assert.equal(isStaleMatchList(expected, [{}]), false); // event sans matchid
  assert.equal(isStaleMatchList(null, [{ matchid: "5" }]), false); // code de départ illisible
});

// --- tracker de timeouts consécutifs (gel socket-vivant) -------------------

test("createTimeoutTracker : trip au N-ième timeout consécutif, puis se réarme", () => {
  let trips = 0;
  const t = createTimeoutTracker(3, () => trips++);
  t.recordTimeout();
  t.recordTimeout();
  assert.equal(trips, 0);
  t.recordTimeout();
  assert.equal(trips, 1); // 3 d'affilée → armement
  t.recordTimeout();
  t.recordTimeout();
  t.recordTimeout();
  assert.equal(trips, 2); // réarmé
});

test("createTimeoutTracker : un succès remet le compteur à zéro", () => {
  let trips = 0;
  const t = createTimeoutTracker(3, () => trips++);
  t.recordTimeout();
  t.recordTimeout();
  t.recordSuccess();
  t.recordTimeout();
  t.recordTimeout();
  assert.equal(trips, 0); // le succès a cassé la série
  t.recordTimeout();
  assert.equal(trips, 1);
});
