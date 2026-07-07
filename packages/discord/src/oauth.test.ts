import { test } from "node:test";
import assert from "node:assert/strict";
import { DiscordOAuthClient, DiscordError } from "./oauth";

const OPTS = {
  clientId: "cid",
  clientSecret: "secret",
  redirectUri: "http://localhost:3001/auth/callback",
};

function fakeFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

test("authorizeUrl : client_id, redirect, scopes identify+guilds et state", () => {
  const client = new DiscordOAuthClient(OPTS);
  const url = new URL(client.authorizeUrl("csrf-123"));
  assert.equal(url.origin + url.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), OPTS.redirectUri);
  assert.equal(url.searchParams.get("scope"), "identify guilds");
  assert.equal(url.searchParams.get("state"), "csrf-123");
});

test("exchangeCode : POST form-encoded, renvoie l'access token", async () => {
  let sentBody = "";
  const client = new DiscordOAuthClient({
    ...OPTS,
    fetchImpl: fakeFetch((url, init) => {
      assert.ok(url.endsWith("/oauth2/token"));
      sentBody = String(init?.body);
      return { status: 200, body: { access_token: "tok-1", token_type: "Bearer" } };
    }),
  });
  assert.equal(await client.exchangeCode("the-code"), "tok-1");
  const params = new URLSearchParams(sentBody);
  assert.equal(params.get("code"), "the-code");
  assert.equal(params.get("grant_type"), "authorization_code");
});

test("exchangeCode : réponse non-ok → DiscordError avec le status", async () => {
  const client = new DiscordOAuthClient({
    ...OPTS,
    fetchImpl: fakeFetch(() => ({ status: 400, body: { error: "invalid_grant" } })),
  });
  await assert.rejects(client.exchangeCode("bad"), (err: unknown) => {
    assert.ok(err instanceof DiscordError);
    assert.equal(err.status, 400);
    return true;
  });
});

test("getUser : displayName = global_name, sinon username ; réponse zod-validée", async () => {
  const client = new DiscordOAuthClient({
    ...OPTS,
    fetchImpl: fakeFetch(() => ({
      status: 200,
      body: { id: "42", username: "noe", global_name: "Noé", avatar: null },
    })),
  });
  const u = await client.getUser("tok");
  assert.deepEqual(u, { id: "42", username: "noe", displayName: "Noé", avatar: null });

  const noGlobal = new DiscordOAuthClient({
    ...OPTS,
    fetchImpl: fakeFetch(() => ({ status: 200, body: { id: "42", username: "noe" } })),
  });
  assert.equal((await noGlobal.getUser("tok")).displayName, "noe");
});

test("getUser : payload invalide → zod rejette", async () => {
  const client = new DiscordOAuthClient({
    ...OPTS,
    fetchImpl: fakeFetch(() => ({ status: 200, body: { nope: true } })),
  });
  await assert.rejects(client.getUser("tok"));
});

test("isGuildMember : true si la guild est dans la liste", async () => {
  const client = new DiscordOAuthClient({
    ...OPTS,
    fetchImpl: fakeFetch(() => ({ status: 200, body: [{ id: "g1" }, { id: "g2" }] })),
  });
  assert.equal(await client.isGuildMember("tok", "g2"), true);
  assert.equal(await client.isGuildMember("tok", "g9"), false);
});
