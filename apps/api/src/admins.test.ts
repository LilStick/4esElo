import "./env";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql, inArray } from "drizzle-orm";
import { db, players } from "@4eselo/db";
import type { DiscordOAuth } from "@4eselo/discord";
import type { AdminsResponse } from "@4eselo/types";
import { app } from "./app";
import { authDeps } from "./auth";

/** Intégration rôles admin (B12.10) - OAuth Discord mocké, vraie DB. */

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
const MEMBER = "444444";
const RANDO = "333333";
const UNKNOWN = "666666";
const TEST_IDS = [ADMIN, MEMBER];

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

const getAdmins = (cookie: string) => app.request("/admin/admins", { headers: { cookie } });
const putAdmin = (cookie: string, id: string) =>
  app.request(`/admin/admins/${id}`, { method: "PUT", headers: { cookie } });
const delAdmin = (cookie: string, id: string) =>
  app.request(`/admin/admins/${id}`, { method: "DELETE", headers: { cookie } });

const saved = { config: authDeps.config, oauth: authDeps.oauth };

before(async () => {
  authDeps.config = FAKE_CONFIG;
  if (DB_UP) {
    await db.delete(players).where(inArray(players.discordId, TEST_IDS));
    await db.insert(players).values([
      { discordId: ADMIN, discordName: "Root", faceitId: "fc-admin-b1210", faceitNickname: "root" },
      { discordId: MEMBER, discordName: "Member", faceitId: "fc-member-b1210", faceitNickname: "member" },
    ]);
  }
});
beforeEach(async () => {
  if (DB_UP) await db.update(players).set({ isAdmin: false }).where(inArray(players.discordId, TEST_IDS));
});
after(async () => {
  authDeps.config = saved.config;
  authDeps.oauth = saved.oauth;
  if (DB_UP) await db.delete(players).where(inArray(players.discordId, TEST_IDS));
});

test("admins : réservés aux admins (401 anonyme, 403 non-admin)", { skip }, async () => {
  assert.equal((await app.request("/admin/admins")).status, 401);
  const rando = await sessionFor(RANDO);
  assert.equal((await getAdmins(rando)).status, 403);
  assert.equal((await putAdmin(rando, MEMBER)).status, 403);
});

test("liste : le socle env figure en source 'env'", { skip }, async () => {
  const adminC = await sessionFor(ADMIN);
  const list = (await (await getAdmins(adminC)).json()) as AdminsResponse;
  const root = list.admins.find((a) => a.discordId === ADMIN);
  assert.ok(root);
  assert.equal(root!.source, "env");
});

test("promotion → le membre devient admin, puis rétrogradation", { skip }, async () => {
  const adminC = await sessionFor(ADMIN);
  const memberC = await sessionFor(MEMBER);
  assert.equal((await getAdmins(memberC)).status, 403);

  assert.equal((await putAdmin(adminC, MEMBER)).status, 200);
  const listed = (await (await getAdmins(adminC)).json()) as AdminsResponse;
  const m = listed.admins.find((a) => a.discordId === MEMBER);
  assert.ok(m && m.source === "db");
  assert.equal((await getAdmins(memberC)).status, 200);

  assert.equal((await delAdmin(adminC, MEMBER)).status, 200);
  const after = (await (await getAdmins(adminC)).json()) as AdminsResponse;
  assert.equal(
    after.admins.find((a) => a.discordId === MEMBER),
    undefined,
  );
  assert.equal((await getAdmins(memberC)).status, 403);
});

test("garde-fous : env non-retirable + membre inconnu", { skip }, async () => {
  const adminC = await sessionFor(ADMIN);
  assert.equal((await delAdmin(adminC, ADMIN)).status, 400);
  assert.equal((await putAdmin(adminC, UNKNOWN)).status, 404);
});

test(
  "gestion des admins réservée au root (un admin base ne peut ni promouvoir ni retirer)",
  { skip },
  async () => {
    const adminC = await sessionFor(ADMIN);
    const memberC = await sessionFor(MEMBER);
    await putAdmin(adminC, MEMBER);
    assert.equal((await getAdmins(memberC)).status, 200);
    assert.equal((await putAdmin(memberC, "777777")).status, 403);
    assert.equal((await delAdmin(memberC, MEMBER)).status, 403);
  },
);

test("anti-lockout : impossible de bannir un admin en base", { skip }, async () => {
  const adminC = await sessionFor(ADMIN);
  await putAdmin(adminC, MEMBER);
  const res = await app.request(`/admin/bans/${MEMBER}`, {
    method: "PUT",
    headers: { cookie: adminC, "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(res.status, 400);
});
