import "./env";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql, inArray } from "drizzle-orm";
import { db, players } from "@4eselo/db";
import type { DiscordOAuth } from "@4eselo/discord";
import type { PremierConnectionStatus } from "@4eselo/types";
import { app } from "./app";
import { authDeps } from "./auth";
import { premierDeps } from "./premier";

/** Intégration onboarding Premier (B18.2) - OAuth Discord mocké, vraie DB. */

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

const MEMBER = "800001";
const RANDO = "800002";
const TEST_IDS = [MEMBER];

const FAKE_CONFIG = {
  clientId: "cid",
  clientSecret: "csecret",
  redirectUri: "http://localhost:3001/auth/callback",
  guildId: "guild-4esport",
  guildInviteUrl: null,
  sessionSecret: "test-secret-0123456789-0123456789-abc",
  adminDiscordIds: [] as string[],
};

function fakeOAuth(user: { id: string; displayName: string }): DiscordOAuth {
  return {
    authorizeUrl: (state) => `https://discord.test/authorize?state=${state}`,
    exchangeCode: async () => "fake-token",
    isGuildMember: async () => true,
    getUser: async () => ({ ...user, username: user.displayName, avatar: null }),
  };
}

async function sessionFor(discordId: string): Promise<string> {
  authDeps.oauth = fakeOAuth({ id: discordId, displayName: `User-${discordId}` });
  const login = await app.request("/auth/login");
  const stateCookie = login.headers.getSetCookie().map((c) => c.split(";")[0]!)[0]!;
  const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
  const cb = await app.request(`/auth/callback?code=abc&state=${state}`, {
    headers: { cookie: stateCookie },
  });
  return cb.headers
    .getSetCookie()
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("4eselo_session="))!;
}

const status = (cookie: string) => app.request("/premier/status", { headers: { cookie } });
const connect = (cookie: string, body: unknown) =>
  app.request("/premier/connect", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const disconnect = (cookie: string) =>
  app.request("/premier/connect", { method: "DELETE", headers: { cookie } });

const GOOD = { steamAuthCode: "8T6K-AH6HB-JM2R", shareCode: "CSGO-VGAOZ-Fukap-pA46K-3nszD-FdcNE" };

const saved = {
  config: authDeps.config,
  oauth: authDeps.oauth,
  enabled: premierDeps.enabled,
  encKey: premierDeps.encKey,
};

before(async () => {
  authDeps.config = FAKE_CONFIG;
  premierDeps.enabled = true;
  premierDeps.encKey = "0".repeat(64);
  if (DB_UP) {
    await db.delete(players).where(inArray(players.discordId, TEST_IDS));
    await db
      .insert(players)
      .values({
        discordId: MEMBER,
        discordName: "Member",
        faceitId: "fc-prem-b1802",
        faceitNickname: "prem",
      });
  }
});
beforeEach(async () => {
  if (DB_UP)
    await db
      .update(players)
      .set({ premierAuthCodeEnc: null, premierShareCode: null, premierSyncedAt: null })
      .where(inArray(players.discordId, TEST_IDS));
});
after(async () => {
  authDeps.config = saved.config;
  authDeps.oauth = saved.oauth;
  premierDeps.enabled = saved.enabled;
  premierDeps.encKey = saved.encKey;
  if (DB_UP) await db.delete(players).where(inArray(players.discordId, TEST_IDS));
});

test("premier : 401 anonyme", { skip }, async () => {
  assert.equal((await app.request("/premier/status")).status, 401);
  assert.equal((await connect("", GOOD)).status, 401);
});

test("premier : 503 quand le flag est off", { skip }, async () => {
  const c = await sessionFor(MEMBER);
  premierDeps.enabled = false;
  try {
    assert.equal((await status(c)).status, 503);
    assert.equal((await connect(c, GOOD)).status, 503);
  } finally {
    premierDeps.enabled = true;
  }
});

test("premier : connect → status connecté → disconnect", { skip }, async () => {
  const c = await sessionFor(MEMBER);
  let s = (await (await status(c)).json()) as PremierConnectionStatus;
  assert.equal(s.connected, false);

  assert.equal((await connect(c, GOOD)).status, 200);
  s = (await (await status(c)).json()) as PremierConnectionStatus;
  assert.equal(s.connected, true);

  // le auth code est stocké chiffré, pas en clair
  const [row] = await db
    .select({ enc: players.premierAuthCodeEnc, sc: players.premierShareCode })
    .from(players)
    .where(inArray(players.discordId, TEST_IDS));
  assert.ok(row!.enc && !row!.enc.includes(GOOD.steamAuthCode));
  assert.equal(row!.sc, GOOD.shareCode);

  assert.equal((await disconnect(c)).status, 200);
  s = (await (await status(c)).json()) as PremierConnectionStatus;
  assert.equal(s.connected, false);
});

test("premier : body invalide → 400", { skip }, async () => {
  const c = await sessionFor(MEMBER);
  assert.equal((await connect(c, { steamAuthCode: "x", shareCode: "nope" })).status, 400);
});

test("premier : membre inconnu (pas inscrit) → 404", { skip }, async () => {
  const c = await sessionFor(RANDO);
  assert.equal((await connect(c, GOOD)).status, 404);
});
