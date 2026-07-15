import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { db, players } from "@4eselo/db";
import { FaceitNotFoundError, type FaceitPlayer } from "@4eselo/faceit";
import type { DiscordOAuth } from "@4eselo/discord";
import type { RegisterLookupResponse, RegisterResponse } from "@4eselo/types";
import { app } from "./app";
import { authDeps } from "./auth";
import { registerDeps, isAlumni } from "./register";

/**
 * Intégration register (B17.2) - Faceit ET Discord mockés, vraie DB.
 * Skip propre si Postgres absent.
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
const skip = DB_UP ? false : "requires Postgres - run `pnpm db:up`";

const FAKE_CONFIG = {
  clientId: "cid",
  clientSecret: "csecret",
  redirectUri: "http://localhost:3001/auth/callback",
  guildId: "guild-4esport",
  guildInviteUrl: null,
  sessionSecret: "test-secret-0123456789-0123456789-abc",
  adminDiscordIds: [],
};

const KNOWN: FaceitPlayer = {
  playerId: "faceit-ireg-1",
  nickname: "iRegNick",
  avatar: "https://cdn.faceit.test/a.png",
  country: "fr",
  cs2: { elo: 2001, skillLevel: 10, steamId64: "765_ireg" },
};

const fakeFaceit = {
  async getPlayerByNickname(nickname: string): Promise<FaceitPlayer> {
    if (nickname.toLowerCase() === KNOWN.nickname.toLowerCase()) return KNOWN;
    throw new FaceitNotFoundError(404, "/players");
  },
};

function fakeOAuth(user: { id: string; displayName: string }): DiscordOAuth {
  return {
    authorizeUrl: (state) => `https://discord.test/authorize?state=${state}`,
    exchangeCode: async () => "fake-token",
    isGuildMember: async () => true,
    getUser: async () => ({ ...user, username: user.displayName, avatar: "avatar-hash" }),
  };
}

/** Session valide pour un discordId donné (flow login→callback complet). */
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

const saved = { config: authDeps.config, oauth: authDeps.oauth, faceit: registerDeps.faceit };

before(() => {
  authDeps.config = FAKE_CONFIG;
  registerDeps.faceit = fakeFaceit;
});

after(async () => {
  authDeps.config = saved.config;
  authDeps.oauth = saved.oauth;
  registerDeps.faceit = saved.faceit;
  if (DB_UP) await db.delete(players).where(eq(players.faceitId, KNOWN.playerId));
});

const postRegister = (cookie: string, body: unknown) =>
  app.request("/register", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const GOOD_BODY = { faceitNickname: "iRegNick", formation: "Mastère Dev", promoStart: 2026, promoEnd: 2028 };

test("isAlumni : fin de promo passée seulement", () => {
  const now = new Date("2026-07-07T00:00:00Z");
  assert.equal(isAlumni(2028, now), false);
  assert.equal(isAlumni(2026, now), false); // encore en cours cette année
  assert.equal(isAlumni(2025, now), true);
});

test("register/lookup et POST /register exigent une session", async () => {
  assert.equal((await app.request("/register/lookup?nickname=x")).status, 401);
  assert.equal((await postRegister("", GOOD_BODY)).status, 401);
});

test("lookup : préviusalisation du pseudo, 404 clair si introuvable", { skip }, async () => {
  const cookie = await sessionFor("reg-discord-1");
  const res = await app.request("/register/lookup?nickname=iregnick", { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = (await res.json()) as RegisterLookupResponse;
  assert.equal(body.nickname, "iRegNick");
  assert.equal(body.elo, 2001);
  assert.equal(body.alreadyClaimed, false);

  const missing = await app.request("/register/lookup?nickname=nope", { headers: { cookie } });
  assert.equal(missing.status, 404);
  assert.match(((await missing.json()) as { error: string }).error, /introuvable/);
});

test("register de bout en bout : insert complet, puis doublons refusés proprement", { skip }, async () => {
  const cookie = await sessionFor("reg-discord-1");
  const res = await postRegister(cookie, GOOD_BODY);
  assert.equal(res.status, 201);
  const body = (await res.json()) as RegisterResponse;
  assert.equal(body.player.faceitNickname, "iRegNick");
  assert.equal(body.formation, "Mastère Dev");
  assert.equal(body.promoStart, 2026);
  assert.equal(body.promoEnd, 2028);
  assert.equal(body.isAlumni, false);

  const [row] = await db.select().from(players).where(eq(players.faceitId, KNOWN.playerId));
  assert.ok(row);
  assert.equal(row.discordId, "reg-discord-1");
  assert.equal(row.discordAvatar, "avatar-hash");
  assert.equal(row.steamId64, "765_ireg");
  assert.equal(row.formation, "Mastère Dev");

  // le lookup le voit maintenant comme réclamé
  const claimed = (await (
    await app.request("/register/lookup?nickname=iRegNick", { headers: { cookie } })
  ).json()) as RegisterLookupResponse;
  assert.equal(claimed.alreadyClaimed, true);

  // même Discord → déjà inscrit
  const again = await postRegister(cookie, GOOD_BODY);
  assert.equal(again.status, 409);
  assert.match(((await again.json()) as { error: string }).error, /déjà inscrit/);

  // autre Discord, même Faceit → compte déjà relié
  const other = await postRegister(await sessionFor("reg-discord-2"), GOOD_BODY);
  assert.equal(other.status, 409);
  assert.match(((await other.json()) as { error: string }).error, /déjà relié/);
});

test("register : pseudo introuvable → 404, body invalide → 400", { skip }, async () => {
  const cookie = await sessionFor("reg-discord-3");
  assert.equal((await postRegister(cookie, { ...GOOD_BODY, faceitNickname: "nope" })).status, 404);
  assert.equal((await postRegister(cookie, { ...GOOD_BODY, promoEnd: 2024 })).status, 400); // fin < début
  assert.equal((await postRegister(cookie, { faceitNickname: "iRegNick" })).status, 400);
});

test("register non configuré (pas de clé Faceit) → 503", { skip }, async () => {
  registerDeps.faceit = null;
  try {
    const cookie = await sessionFor("reg-discord-4");
    assert.equal((await app.request("/register/lookup?nickname=x", { headers: { cookie } })).status, 503);
    assert.equal((await postRegister(cookie, GOOD_BODY)).status, 503);
  } finally {
    registerDeps.faceit = fakeFaceit;
  }
});
