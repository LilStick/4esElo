import "../env"; // charge .env (DATABASE_URL) avant @4eselo/db
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql, and, eq, inArray } from "drizzle-orm";
import { db, players, eloSnapshots, premierMatchStats } from "@4eselo/db";
import { encryptSecret, type MatchWalker, type PremierMatchResolver } from "@4eselo/premier";
import { dbPremierStore, getConnectedMembers } from "./store";
import { runPremierSync } from "./runSync";

/** Intégration sync Premier (B18.4) - vraie DB, Steam (walker/resolver) mocké. */

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

const KEY = "0".repeat(64);
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
const STEAM_ID = "76561199000000001";
const FACEIT_ID = "fc-premier-b1804";
let playerId = "";

async function reset() {
  await db.delete(players).where(inArray(players.faceitId, [FACEIT_ID])); // cascade → snapshots
  const [p] = await db
    .insert(players)
    .values({
      faceitId: FACEIT_ID,
      steamId64: STEAM_ID,
      premierAuthCodeEnc: encryptSecret("AUTH-CODE", KEY),
      premierShareCode: "CSGO-seed",
    })
    .returning({ id: players.id });
  playerId = p!.id;
}

const premierSnapshots = () =>
  db
    .select({ elo: eloSnapshots.elo })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, playerId), eq(eloSnapshots.source, "premier")))
    .orderBy(eloSnapshots.capturedAt);

before(async () => {
  if (DB_UP) await reset();
});
beforeEach(async () => {
  if (DB_UP) await reset();
});
after(async () => {
  if (DB_UP) await db.delete(players).where(inArray(players.faceitId, [FACEIT_ID]));
});

test("dbPremierStore : snapshot-on-change (insère seulement si le rating change)", { skip }, async () => {
  const t = new Date("2026-07-01T00:00:00Z");
  await dbPremierStore.recordRating(playerId, 14000, t);
  await dbPremierStore.recordRating(playerId, 14000, new Date("2026-07-02T00:00:00Z")); // même → skip
  await dbPremierStore.recordRating(playerId, 14300, new Date("2026-07-03T00:00:00Z")); // change → insert
  const snaps = await premierSnapshots();
  assert.deepEqual(
    snaps.map((s) => s.elo),
    [14000, 14300],
  );
});

test("dbPremierStore : advanceCursor met à jour share code + syncedAt", { skip }, async () => {
  await dbPremierStore.advanceCursor(playerId, "CSGO-newcursor", new Date("2026-07-05T00:00:00Z"));
  const [p] = await db
    .select({ sc: players.premierShareCode, at: players.premierSyncedAt })
    .from(players)
    .where(eq(players.id, playerId));
  assert.equal(p!.sc, "CSGO-newcursor");
  assert.ok(p!.at);
});

test("runPremierSync : membre connecté → walk → snapshots en base + curseur avancé", { skip }, async () => {
  const walker: MatchWalker = {
    nextShareCode: async () => null,
    walkFrom: async () => ["CSGO-1", "CSGO-2"],
  };
  // 1er sync (premierSyncedAt null) → le seed CSGO-seed est résolu aussi.
  const ratings: Record<string, number> = { "CSGO-seed": 13900, "CSGO-1": 14000, "CSGO-2": 14200 };
  const resolver: PremierMatchResolver = {
    resolve: async (_sid, code) => {
      const r = ratings[code];
      return r === undefined
        ? null
        : {
            ratingAfter: r,
            playedAt: new Date("2026-07-04T00:00:00Z"),
            map: "de_ancient",
            result: "win",
            myScore: 13,
            oppScore: 7,
            stats: { ...ZERO_STATS, kills: 20, deaths: 15, adr: 80 },
          };
    },
  };

  const res = await runPremierSync({ walker, resolver, encKey: KEY });
  assert.ok(res.members >= 1);
  assert.equal(res.snapshots, 3);

  const snaps = await premierSnapshots();
  assert.deepEqual(
    snaps.map((s) => s.elo),
    [13900, 14000, 14200],
  );
  const [p] = await db.select({ sc: players.premierShareCode }).from(players).where(eq(players.id, playerId));
  assert.equal(p!.sc, "CSGO-2"); // curseur avancé au dernier match

  // B18.14 : une ligne de stats par match résolu (seed + 2 walkés).
  const countStats = async () =>
    (
      await db
        .select({ sc: premierMatchStats.shareCode })
        .from(premierMatchStats)
        .where(eq(premierMatchStats.playerId, playerId))
    ).length;
  assert.equal(await countStats(), 3);

  // Idempotent : un 2e passage ne crée pas de doublon (upsert sur (shareCode, player)).
  await runPremierSync({ walker, resolver, encKey: KEY });
  assert.equal(await countStats(), 3);
});

test("getConnectedMembers : ne renvoie que les membres avec auth code + share code", { skip }, async () => {
  const members = await getConnectedMembers();
  const mine = members.find((m) => m.steamId64 === STEAM_ID);
  assert.ok(mine, "le membre connecté doit apparaître");
  assert.equal(mine!.shareCode, "CSGO-seed");
});
