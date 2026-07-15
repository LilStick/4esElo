import "./env";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql, inArray } from "drizzle-orm";
import { db, bannedDiscordIds } from "@4eselo/db";
import type { DiscordOAuth } from "@4eselo/discord";
import type { BansResponse, MeResponse } from "@4eselo/types";
import { app } from "./app";
import { authDeps } from "./auth";
import { invalidateBanCache } from "./banCache";

/** Intégration bans (B17.9) - OAuth Discord mocké, vraie DB. */

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

const ADMIN = "111111";
const VICTIM = "222222";
const RANDO = "333333";
const BANNED_LOGIN = "999999";
const TEST_IDS = [VICTIM, BANNED_LOGIN];

const FAKE_CONFIG = {
  clientId: "cid",
  clientSecret: "csecret",
  redirectUri: "http://localhost:3001/auth/callback",
  guildId: "guild-4esport",
  guildInviteUrl: null,
  sessionSecret: "test-secret-0123456789-0123456789-abc",
  adminDiscordIds: [ADMIN],
};

function fakeOAuth(user: { id: string; displayName: string }): DiscordOAuth {
  return {
    authorizeUrl: (state) => `https://discord.test/authorize?state=${state}`,
    exchangeCode: async () => "fake-token",
    isGuildMember: async () => true,
    getUser: async () => ({ ...user, username: user.displayName, avatar: null }),
  };
}

/** Cookie de session valide pour un discordId (login→callback). Vide si banni (aucun cookie posé). */
async function sessionFor(discordId: string): Promise<string | undefined> {
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
    .find((c) => c.startsWith("4eselo_session="));
}

const saved = { config: authDeps.config, oauth: authDeps.oauth };

before(() => {
  authDeps.config = FAKE_CONFIG;
});
beforeEach(async () => {
  if (DB_UP) await db.delete(bannedDiscordIds).where(inArray(bannedDiscordIds.discordId, TEST_IDS));
  invalidateBanCache();
});
after(async () => {
  authDeps.config = saved.config;
  authDeps.oauth = saved.oauth;
  if (DB_UP) {
    await db.delete(bannedDiscordIds).where(inArray(bannedDiscordIds.discordId, TEST_IDS));
    invalidateBanCache();
  }
});

const putBan = (cookie: string, id: string, body: unknown) =>
  app.request(`/admin/bans/${id}`, {
    method: "PUT",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
const delBan = (cookie: string, id: string) =>
  app.request(`/admin/bans/${id}`, { method: "DELETE", headers: { cookie } });
const meAuth = async (cookie: string) =>
  ((await (await app.request("/me", { headers: { cookie } })).json()) as MeResponse).authenticated;

test("bans : réservés aux admins (401 anonyme, 403 non-admin)", { skip }, async () => {
  assert.equal((await app.request("/admin/bans")).status, 401);
  const rando = (await sessionFor(RANDO))!;
  assert.equal((await app.request("/admin/bans", { headers: { cookie: rando } })).status, 403);
  assert.equal((await putBan(rando, VICTIM, { reason: "x" })).status, 403);
});

test("ban coupe la session active immédiatement + figure dans la liste", { skip }, async () => {
  const adminC = (await sessionFor(ADMIN))!;
  const victimC = (await sessionFor(VICTIM))!;
  assert.equal(await meAuth(victimC), true); // avant ban : connecté

  assert.equal((await putBan(adminC, VICTIM, { reason: "spam" })).status, 200);
  assert.equal(await meAuth(victimC), false); // session coupée sans re-login

  const list = (await (
    await app.request("/admin/bans", { headers: { cookie: adminC } })
  ).json()) as BansResponse;
  const b = list.bans.find((x) => x.discordId === VICTIM);
  assert.ok(b, "le ban doit figurer dans la liste");
  assert.equal(b!.reason, "spam");
  assert.equal(b!.bannedBy, ADMIN);
});

test("login d'un banni → redirect ?auth=banned, aucune session posée", { skip }, async () => {
  const adminC = (await sessionFor(ADMIN))!;
  await putBan(adminC, BANNED_LOGIN, {});

  authDeps.oauth = fakeOAuth({ id: BANNED_LOGIN, displayName: "Banned" });
  const login = await app.request("/auth/login");
  const stateCookie = login.headers.getSetCookie().map((c) => c.split(";")[0]!)[0]!;
  const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
  const cb = await app.request(`/auth/callback?code=abc&state=${state}`, {
    headers: { cookie: stateCookie },
  });
  assert.equal(cb.status, 302);
  assert.match(cb.headers.get("location")!, /auth=banned/);
  const sessionCookie = cb.headers.getSetCookie().find((c) => c.startsWith("4eselo_session="));
  assert.equal(sessionCookie, undefined);
});

test("unban → la personne se reconnecte (session de nouveau valide)", { skip }, async () => {
  const adminC = (await sessionFor(ADMIN))!;
  const victimC = (await sessionFor(VICTIM))!;
  await putBan(adminC, VICTIM, {});
  assert.equal(await meAuth(victimC), false);

  assert.equal((await delBan(adminC, VICTIM)).status, 200);
  assert.equal(await meAuth(victimC), true); // ban levé → cookie de nouveau accepté
});

test("ban : refuse un admin (anti-lockout) et un id non numérique", { skip }, async () => {
  const adminC = (await sessionFor(ADMIN))!;
  assert.equal((await putBan(adminC, ADMIN, {})).status, 400);
  assert.equal((await putBan(adminC, "not-a-snowflake", {})).status, 400);
});
