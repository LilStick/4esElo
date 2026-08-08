import "./env";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql, eq, desc } from "drizzle-orm";
import { db, players, eloSnapshots, faceitMatchStats } from "@4eselo/db";
import type { FaceitPlayer, FaceitMatchRef, FaceitMatchDetail } from "@4eselo/faceit";
import type { FaceitMatchStats, RefreshEloResponse } from "@4eselo/types";
import { app } from "./app";
import { refreshDeps, resetRefreshCooldown } from "./refresh";

/** Intégration refresh ELO à la demande (B16.6) - Faceit mocké, vraie DB. */

async function dbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
const DB_UP = await dbReachable();
const skip = DB_UP ? false : "requires Postgres - run `pnpm db:up`";

let pid = "";
let currentElo = 1500; // ce que le faux Faceit renvoie (mutable par test)
let unranked = false; // simule un joueur en placement (Season 8+)
let matchHistory: FaceitMatchRef[] = []; // historique renvoyé par le faux Faceit
let matchStats: Record<string, FaceitMatchDetail | null> = {};

const zeroStats = (): FaceitMatchStats =>
  Object.fromEntries(
    [
      "kills",
      "deaths",
      "assists",
      "kd",
      "kr",
      "adr",
      "damage",
      "hsPercent",
      "mvps",
      "doubleKills",
      "tripleKills",
      "quadroKills",
      "pentaKills",
      "clutch1v1Count",
      "clutch1v1Wins",
      "clutch1v2Count",
      "clutch1v2Wins",
      "clutchKills",
      "entryCount",
      "entryWins",
      "firstKills",
      "utilityDamage",
      "utilityCount",
      "flashCount",
      "enemiesFlashed",
      "flashSuccesses",
      "sniperKills",
    ].map((k) => [k, 0]),
  ) as unknown as FaceitMatchStats;

const fakeFaceit = {
  async getPlayerById(): Promise<FaceitPlayer> {
    return {
      playerId: "f-iref",
      nickname: "iref",
      avatar: null,
      country: "fr",
      cs2: unranked
        ? { elo: null, skillLevel: null, steamId64: "765_iref", unranked: true }
        : { elo: currentElo, skillLevel: 8, steamId64: "765_iref", unranked: false },
    };
  },
  async getMatchHistory(_faceitId: string, opts: { limit: number; offset: number }) {
    return opts.offset === 0 ? matchHistory : []; // une seule page
  },
  async getMatchStats(matchId: string) {
    return matchStats[matchId] ?? null;
  },
};

const saved = { faceit: refreshDeps.faceit, bot: refreshDeps.bot };

before(async () => {
  refreshDeps.faceit = fakeFaceit;
  refreshDeps.bot = null; // pas d'appel Discord réel par défaut
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({
      discordName: "iref",
      discordId: "d-iref",
      discordAvatar: "old-hash",
      faceitNickname: "iref",
      faceitId: "f-iref",
      steamId64: "765_iref",
    })
    .returning({ id: players.id });
  pid = p!.id;
  await db.insert(eloSnapshots).values({ playerId: pid, source: "faceit", elo: 1400, level: 7 }); // baseline
});

beforeEach(() => {
  resetRefreshCooldown();
  currentElo = 1500;
  unranked = false;
  matchHistory = [];
  matchStats = {};
  refreshDeps.bot = null;
});

after(async () => {
  refreshDeps.faceit = saved.faceit;
  refreshDeps.bot = saved.bot;
  if (DB_UP && pid) await db.delete(players).where(eq(players.id, pid)); // cascade → snapshots + matchs
});

const post = (id: string) => app.request(`/players/${id}/refresh`, { method: "POST" });
const snapCount = async () =>
  (
    await db
      .select({ c: sql<number>`count(*)::int` })
      .from(eloSnapshots)
      .where(eq(eloSnapshots.playerId, pid))
  )[0]!.c;

test("refresh : resync et insère un snapshot si l'ELO a changé", { skip }, async () => {
  currentElo = 1500; // baseline 1400 → changement
  const res = await post(pid);
  assert.equal(res.status, 200);
  const body = (await res.json()) as RefreshEloResponse;
  assert.equal(body.elo, 1500);
  assert.equal(body.changed, true);
  const [latest] = await db
    .select({ elo: eloSnapshots.elo })
    .from(eloSnapshots)
    .where(eq(eloSnapshots.playerId, pid))
    .orderBy(desc(eloSnapshots.capturedAt))
    .limit(1);
  assert.equal(latest!.elo, 1500);
});

test("refresh : ELO inchangé → changed:false, aucun nouveau snapshot", { skip }, async () => {
  await db.insert(eloSnapshots).values({ playerId: pid, source: "faceit", elo: 1500, level: 8 });
  const before = await snapCount();
  currentElo = 1500; // == dernier snapshot
  const body = (await (await post(pid)).json()) as RefreshEloResponse;
  assert.equal(body.changed, false);
  assert.equal(await snapCount(), before); // pas d'insert
});

test("refresh : joueur en placement → elo null, unranked true, aucun snapshot", { skip }, async () => {
  unranked = true;
  const before = await snapCount();
  const res = await post(pid);
  assert.equal(res.status, 200);
  const body = (await res.json()) as RefreshEloResponse;
  assert.equal(body.elo, null);
  assert.equal(body.changed, false);
  assert.equal(body.unranked, true);
  assert.equal(await snapCount(), before); // ELO caché → pas de point de courbe
});

test("refresh : met à jour l'avatar Discord si le hash a changé (pp)", { skip }, async () => {
  refreshDeps.bot = { getUserAvatar: async () => "new-hash" }; // pp changée côté Discord
  const res = await post(pid);
  assert.equal(res.status, 200);
  const [row] = await db.select({ av: players.discordAvatar }).from(players).where(eq(players.id, pid));
  assert.equal(row!.av, "new-hash");
});

test("refresh : ré-ingère un nouveau match du membre", { skip }, async () => {
  const started = new Date(Date.now() - 60 * 60 * 1000); // il y a 1h (dans la fenêtre 30j)
  matchHistory = [{ matchId: "m-refresh-1", startedAt: started, finishedAt: new Date() }];
  matchStats = {
    "m-refresh-1": {
      matchId: "m-refresh-1",
      map: "de_ancient",
      players: [{ playerId: "f-iref", nickname: "iref", result: 1, stats: zeroStats() }],
      teams: [],
      winnerTeamId: null,
    },
  };
  const res = await post(pid);
  assert.equal(res.status, 200);
  const [row] = await db
    .select({ id: faceitMatchStats.matchId })
    .from(faceitMatchStats)
    .where(eq(faceitMatchStats.matchId, "m-refresh-1"));
  assert.ok(row, "le nouveau match doit être ingéré");
});

test("refresh : 2e appel dans le cooldown → 429", { skip }, async () => {
  assert.equal((await post(pid)).status, 200);
  assert.equal((await post(pid)).status, 429); // pas de reset entre les deux
});

test("refresh : joueur inconnu → 404, id invalide → 400", { skip }, async () => {
  assert.equal((await post("00000000-0000-0000-0000-000000000000")).status, 404);
  assert.equal((await post("not-a-uuid")).status, 400);
});

test("refresh : Faceit non configuré → 503", { skip }, async () => {
  refreshDeps.faceit = null;
  assert.equal((await post(pid)).status, 503);
  refreshDeps.faceit = fakeFaceit;
});
