import "./env";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql, inArray } from "drizzle-orm";
import { db, ideas } from "@4eselo/db";
import type { DiscordOAuth, DiscordWebhookMessage } from "@4eselo/discord";
import type { IdeasResponse, PostIdeaResponse } from "@4eselo/types";
import { app } from "./app";
import { authDeps } from "./auth";
import { ideasDeps } from "./ideas";

/** Intégration boîte à idées (B17.7) — Discord (OAuth + webhook) mocké, vraie DB. */

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

const FAKE_CONFIG = {
  clientId: "cid",
  clientSecret: "csecret",
  redirectUri: "http://localhost:3001/auth/callback",
  guildId: "guild-4esport",
  guildInviteUrl: null,
  sessionSecret: "test-secret-0123456789-0123456789-abc",
  adminDiscordIds: [],
};

function fakeOAuth(user: { id: string; displayName: string }): DiscordOAuth {
  return {
    authorizeUrl: (state) => `https://discord.test/authorize?state=${state}`,
    exchangeCode: async () => "fake-token",
    isGuildMember: async () => true,
    getUser: async () => ({ ...user, username: user.displayName, avatar: null }),
  };
}

/** Session valide pour un discordId (flow login→callback complet). */
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

const TEST_IDS = ["idea-a", "idea-rl", "idea-hook", "idea-b", "idea-bot"];
const saved = {
  config: authDeps.config,
  oauth: authDeps.oauth,
  webhook: ideasDeps.webhook,
  bot: ideasDeps.bot,
  ideasChannelId: ideasDeps.ideasChannelId,
};
let sent: DiscordWebhookMessage[] = [];

before(async () => {
  authDeps.config = FAKE_CONFIG;
  if (DB_UP) await db.delete(ideas).where(inArray(ideas.discordId, TEST_IDS));
});

beforeEach(() => {
  sent = [];
  // Par défaut : pas de bot → relais par webhook (comme la config B17.7 d'origine).
  ideasDeps.bot = null;
  ideasDeps.ideasChannelId = null;
  ideasDeps.webhook = {
    async send(msg) {
      sent.push(msg);
    },
  };
});

after(async () => {
  authDeps.config = saved.config;
  authDeps.oauth = saved.oauth;
  ideasDeps.webhook = saved.webhook;
  ideasDeps.bot = saved.bot;
  ideasDeps.ideasChannelId = saved.ideasChannelId;
  if (DB_UP) await db.delete(ideas).where(inArray(ideas.discordId, TEST_IDS));
});

const postIdea = (cookie: string | null, body: unknown) =>
  app.request("/ideas", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

test("POST/GET /ideas exigent une session (401 anonyme)", { skip }, async () => {
  assert.equal((await postIdea(null, { text: "coucou" })).status, 401);
  assert.equal((await app.request("/ideas")).status, 401);
});

test("POST /ideas stocke, relaie sur Discord et remonte dans GET (mine=true)", { skip }, async () => {
  const cookie = await sessionFor("idea-a");
  const res = await postIdea(cookie, { text: "  Un dark mode stp  " });
  assert.equal(res.status, 201);
  const { idea } = (await res.json()) as PostIdeaResponse;
  assert.equal(idea.text, "Un dark mode stp"); // trim appliqué
  assert.equal(idea.mine, true);

  // relais webhook : le texte part en description
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.description, "Un dark mode stp");

  const list = (await (await app.request("/ideas", { headers: { cookie } })).json()) as IdeasResponse;
  const mine = list.items.find((i) => i.id === idea.id);
  assert.ok(mine, "l'idée doit apparaître dans le fil");
  assert.equal(mine!.mine, true);
  assert.equal(mine!.author, "User-idea-a");
});

test("POST /ideas rejette un texte vide ou trop long (400)", { skip }, async () => {
  const cookie = await sessionFor("idea-a");
  assert.equal((await postIdea(cookie, { text: "   " })).status, 400);
  assert.equal((await postIdea(cookie, { text: "x".repeat(501) })).status, 400);
  assert.equal((await postIdea(cookie, {})).status, 400);
});

test("POST /ideas : 4e idée du jour → 429", { skip }, async () => {
  const cookie = await sessionFor("idea-rl");
  for (let i = 0; i < 3; i++) {
    assert.equal((await postIdea(cookie, { text: `idée ${i}` })).status, 201);
  }
  assert.equal((await postIdea(cookie, { text: "une de trop" })).status, 429);
});

test("POST /ideas : webhook mort → idée quand même stockée, pas de 500", { skip }, async () => {
  ideasDeps.webhook = {
    async send() {
      throw new Error("webhook down");
    },
  };
  const cookie = await sessionFor("idea-hook");
  const res = await postIdea(cookie, { text: "malgré le webhook cassé" });
  assert.equal(res.status, 201); // stockage réussi, échec webhook avalé (loggé)
  const { idea } = (await res.json()) as PostIdeaResponse;
  assert.equal(idea.text, "malgré le webhook cassé");
});

test(
  "POST /ideas : bot configuré → poste dans le salon + amorce ✅/❌ (webhook ignoré) (B17.12)",
  { skip },
  async () => {
    const posts: { channelId: string; description: string }[] = [];
    const reactions: { messageId: string; emoji: string }[] = [];
    ideasDeps.ideasChannelId = "chan-ideas";
    ideasDeps.bot = {
      async postMessage(channelId, msg) {
        posts.push({ channelId, description: msg.description });
        return "msg-42";
      },
      async react(_channelId, messageId, emoji) {
        reactions.push({ messageId, emoji });
      },
    };

    const cookie = await sessionFor("idea-bot");
    const res = await postIdea(cookie, { text: "vote pls" });
    assert.equal(res.status, 201);

    assert.deepEqual(posts, [{ channelId: "chan-ideas", description: "vote pls" }]);
    // ✅ puis ❌ amorcés sur le message posté
    assert.deepEqual(reactions, [
      { messageId: "msg-42", emoji: "✅" },
      { messageId: "msg-42", emoji: "❌" },
    ]);
    assert.equal(sent.length, 0); // le webhook n'est pas utilisé quand le bot relaie
  },
);

test("GET /ideas : l'idée d'un autre membre est mine=false", { skip }, async () => {
  const aCookie = await sessionFor("idea-a");
  const posted = (await (await postIdea(aCookie, { text: "idée de A" })).json()) as PostIdeaResponse;

  const bCookie = await sessionFor("idea-b");
  const list = (await (
    await app.request("/ideas", { headers: { cookie: bCookie } })
  ).json()) as IdeasResponse;
  const seen = list.items.find((i) => i.id === posted.idea.id);
  assert.ok(seen);
  assert.equal(seen!.mine, false);
});
