import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db, players } from "@4eselo/db";
import type { DiscordOAuth } from "@4eselo/discord";
import type { MeResponse } from "@4eselo/types";
import { app } from "./app";
import { authDeps, requireAdmin } from "./auth";

/**
 * Intégration auth (B17.1) — OAuth mocké (aucun réseau), vraie DB pour le
 * match /me ↔ players.discord_id. Skip propre si Postgres absent.
 */

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

const GUILD = "guild-4esport";
const FAKE_CONFIG = {
  clientId: "cid",
  clientSecret: "csecret",
  redirectUri: "http://localhost:3001/auth/callback",
  guildId: GUILD,
  guildInviteUrl: "https://discord.gg/4esport",
  sessionSecret: "test-secret-0123456789-0123456789-abc",
  adminDiscordIds: ["admin-discord-id"],
};

/** Mock complet : `member` pilote l'appartenance au serveur, `user` l'identité. */
function fakeOAuth(
  over: { member?: boolean; user?: { id: string; displayName: string; avatar?: string | null } } = {},
): DiscordOAuth {
  const user = over.user ?? { id: "member-discord-id", displayName: "Noé", avatar: null };
  return {
    authorizeUrl: (state) => `https://discord.test/authorize?state=${state}`,
    exchangeCode: async () => "fake-token",
    isGuildMember: async () => over.member ?? true,
    getUser: async () => ({
      id: user.id,
      username: user.displayName,
      displayName: user.displayName,
      avatar: user.avatar ?? null,
    }),
  };
}

const saved = { config: authDeps.config, oauth: authDeps.oauth };
let memberPlayerId = "";

before(async () => {
  authDeps.config = FAKE_CONFIG;
  authDeps.oauth = fakeOAuth();
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({
      discordId: "member-discord-id",
      discordName: "iauth",
      faceitNickname: "iauth_nick",
      steamId64: "765_iauth",
    })
    .returning({ id: players.id });
  memberPlayerId = p!.id;
});

after(async () => {
  authDeps.config = saved.config;
  authDeps.oauth = saved.oauth;
  if (DB_UP && memberPlayerId) await db.delete(players).where(eq(players.id, memberPlayerId));
});

/** Joue login → callback ; renvoie la redirection finale et le cookie de session à rejouer. */
async function loginAs(oauth: DiscordOAuth): Promise<{ location: string; session: string }> {
  authDeps.oauth = oauth;
  const login = await app.request("/auth/login");
  assert.equal(login.status, 302);
  const stateCookie = login.headers.getSetCookie().map((c) => c.split(";")[0]!)[0]!;
  const state = new URL(login.headers.get("location")!).searchParams.get("state")!;

  const cb = await app.request(`/auth/callback?code=abc&state=${state}`, {
    headers: { cookie: stateCookie },
  });
  assert.equal(cb.status, 302);
  const session = cb.headers
    .getSetCookie()
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("4eselo_session=") && c.length > "4eselo_session=".length);
  return { location: cb.headers.get("location")!, session: session ?? "" };
}

test("login → redirige vers Discord avec un state, posé en cookie signé", async () => {
  const res = await app.request("/auth/login");
  assert.equal(res.status, 302);
  const url = new URL(res.headers.get("location")!);
  assert.equal(url.origin, "https://discord.test");
  assert.ok(url.searchParams.get("state"));
  const cookies = res.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith("4eselo_oauth_state=") && c.includes("HttpOnly")));
});

test("callback : state absent ou différent → redirect ?auth=error, pas de session", async () => {
  const res = await app.request("/auth/callback?code=abc&state=forged");
  assert.equal(res.status, 302);
  assert.ok(res.headers.get("location")!.includes("auth=error"));
});

test("callback membre → session httpOnly posée, redirect ?auth=ok ; /me le reconnaît", { skip }, async () => {
  const { location, session } = await loginAs(fakeOAuth());
  assert.ok(location.includes("auth=ok"));
  assert.ok(session, "session cookie attendu");

  const me = await app.request("/me", { headers: { cookie: session } });
  const body = (await me.json()) as MeResponse;
  assert.equal(body.authenticated, true);
  if (body.authenticated) {
    assert.equal(body.discordId, "member-discord-id");
    assert.equal(body.isAdmin, false);
    assert.equal(body.avatar, null); // fakeOAuth() par défaut n'a pas d'avatar
    assert.equal(body.player?.faceitNickname, "iauth_nick"); // matché via players.discord_id
  }
});

test("/me : avatar de session (frais) prioritaire sur le snapshot DB du joueur", { skip }, async () => {
  const { session } = await loginAs(
    fakeOAuth({ user: { id: "member-discord-id", displayName: "Noé", avatar: "fresh-session-hash" } }),
  );
  // Désync volontaire après coup (simule un snapshot DB qui traînerait) : /me doit
  // quand même privilégier l'avatar de la session, jamais ce qui traîne en DB.
  await db
    .update(players)
    .set({ discordAvatar: "out-of-band-db-hash" })
    .where(eq(players.discordId, "member-discord-id"));

  const me = (await (await app.request("/me", { headers: { cookie: session } })).json()) as MeResponse;
  assert.equal(me.authenticated, true);
  if (me.authenticated) {
    assert.equal(me.avatar, "fresh-session-hash");
    assert.equal(me.player?.discordAvatar, "out-of-band-db-hash");
    assert.notEqual(me.avatar, me.player?.discordAvatar);
  }
});

test(
  "callback : rafraîchit le snapshot DB (avatar) à chaque connexion, pas juste à l'inscription",
  { skip },
  async () => {
    await loginAs(
      fakeOAuth({ user: { id: "member-discord-id", displayName: "Noé", avatar: "login-refresh-hash" } }),
    );
    const [row] = await db
      .select({ discordAvatar: players.discordAvatar })
      .from(players)
      .where(eq(players.discordId, "member-discord-id"))
      .limit(1);
    assert.equal(row?.discordAvatar, "login-refresh-hash");
  },
);

test("callback non-membre du serveur → refus propre avec lien d'invite, aucune session", async () => {
  const { location, session } = await loginAs(fakeOAuth({ member: false }));
  assert.ok(location.includes("auth=not-member"));
  assert.ok(location.includes(encodeURIComponent("https://discord.gg/4esport")));
  assert.equal(session, "");
});

test("/me sans cookie → anonyme ; session inconnue en DB → player null", { skip }, async () => {
  const anon = (await (await app.request("/me")).json()) as MeResponse;
  assert.deepEqual(anon, { authenticated: false });

  const { session } = await loginAs(fakeOAuth({ user: { id: "ghost-discord-id", displayName: "Ghost" } }));
  const me = (await (await app.request("/me", { headers: { cookie: session } })).json()) as MeResponse;
  assert.equal(me.authenticated, true);
  if (me.authenticated) assert.equal(me.player, null);
});

test("logout → cookie de session effacé", { skip }, async () => {
  const { session } = await loginAs(fakeOAuth());
  const out = await app.request("/auth/logout", { method: "POST", headers: { cookie: session } });
  assert.equal(out.status, 200);
  const cleared = out.headers.getSetCookie().find((c) => c.startsWith("4eselo_session="));
  assert.ok(cleared?.includes("Max-Age=0"));
});

test("requireAdmin : 401 anonyme, 403 membre, 200 admin whitelisté", { skip }, async () => {
  const guarded = new Hono();
  guarded.get("/admin/ping", requireAdmin, (c) => c.json({ pong: true }));

  assert.equal((await guarded.request("/admin/ping")).status, 401);

  const { session: memberSession } = await loginAs(fakeOAuth());
  assert.equal((await guarded.request("/admin/ping", { headers: { cookie: memberSession } })).status, 403);

  const { session: adminSession } = await loginAs(
    fakeOAuth({ user: { id: "admin-discord-id", displayName: "Admin" } }),
  );
  assert.equal((await guarded.request("/admin/ping", { headers: { cookie: adminSession } })).status, 200);
});

test("auth non configurée → /auth/* en 503, /me anonyme", async () => {
  const savedConfig = authDeps.config;
  const savedOauth = authDeps.oauth;
  authDeps.config = null;
  authDeps.oauth = null;
  try {
    assert.equal((await app.request("/auth/login")).status, 503);
    assert.equal((await app.request("/auth/callback?code=x&state=y")).status, 503);
    const me = (await (await app.request("/me")).json()) as MeResponse;
    assert.deepEqual(me, { authenticated: false });
  } finally {
    authDeps.config = savedConfig;
    authDeps.oauth = savedOauth;
  }
});
