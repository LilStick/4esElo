import "./env";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { db, players } from "@4eselo/db";
import type { PresenceResponse } from "@4eselo/types";
import type { SteamPresence } from "@4eselo/steam";
import { app } from "./app";
import { presenceDeps, resetPresenceCache } from "./presence";

async function dbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
const DB_UP = await dbReachable();
const skip = DB_UP ? false : "requires Postgres — run `pnpm db:up`";

let inGameId = "";
let offlineId = "";

before(async () => {
  if (!DB_UP) return;
  const [a] = await db
    .insert(players)
    .values({ faceitNickname: "p_ingame", steamId64: "s_ingame", faceitId: "f_ingame" })
    .returning({ id: players.id });
  const [b] = await db
    .insert(players)
    .values({ faceitNickname: "p_off", steamId64: "s_off", faceitId: "f_off" })
    .returning({ id: players.id });
  inGameId = a!.id;
  offlineId = b!.id;
});

after(async () => {
  if (!DB_UP) return;
  await db.delete(players).where(eq(players.id, inGameId));
  await db.delete(players).where(eq(players.id, offlineId));
});

let steamCalls = 0;
let liveCalls: string[] = [];

beforeEach(() => {
  resetPresenceCache();
  steamCalls = 0;
  liveCalls = [];
  presenceDeps.sleep = async () => {};
  presenceDeps.steam = {
    async getPresence(ids): Promise<SteamPresence[]> {
      steamCalls += 1;
      return ids.map((id) => ({
        steamId64: id,
        online: id === "s_ingame",
        inGameCs2: id === "s_ingame",
        onCommunityServer: null,
      }));
    },
  };
  presenceDeps.live = {
    async getOngoingMatch(faceitId) {
      liveCalls.push(faceitId);
      return { inMatch: true, matchId: "m-live" };
    },
  };
});

test("GET /presence: steam states + faceit confirmation only for in-game members", { skip }, async () => {
  const res = await app.request("/presence");
  assert.equal(res.status, 200);
  const body = (await res.json()) as PresenceResponse;

  const inGame = body.players.find((p) => p.id === inGameId);
  const off = body.players.find((p) => p.id === offlineId);
  assert.deepEqual(
    { online: inGame!.online, inGameCs2: inGame!.inGameCs2, inFaceitMatch: inGame!.inFaceitMatch },
    { online: true, inGameCs2: true, inFaceitMatch: true },
  );
  assert.deepEqual(
    { online: off!.online, inGameCs2: off!.inGameCs2, inFaceitMatch: off!.inFaceitMatch },
    { online: false, inGameCs2: false, inFaceitMatch: null },
  );
  assert.deepEqual(liveCalls, ["f_ingame"]); // never called for offline members
});

test("GET /presence: served from cache within the TTL (providers not re-hit)", { skip }, async () => {
  await app.request("/presence");
  await app.request("/presence");
  assert.equal(steamCalls, 1);
});

test("GET /presence: Steam down → online null for everyone, still 200", { skip }, async () => {
  presenceDeps.steam = {
    async getPresence() {
      throw new Error("steam down");
    },
  };
  const res = await app.request("/presence");
  assert.equal(res.status, 200);
  const body = (await res.json()) as PresenceResponse;
  assert.ok(body.players.every((p) => p.online === null && p.inGameCs2 === false));
});

test("GET /presence: Faceit 403 → inFaceitMatch null, Steam answer stands", { skip }, async () => {
  presenceDeps.live = {
    async getOngoingMatch() {
      throw new Error("403 cloudflare");
    },
  };
  const res = await app.request("/presence");
  const body = (await res.json()) as PresenceResponse;
  const inGame = body.players.find((p) => p.id === inGameId);
  assert.equal(inGame!.inGameCs2, true);
  assert.equal(inGame!.inFaceitMatch, null);
});
