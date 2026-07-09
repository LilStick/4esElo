import { test } from "node:test";
import assert from "node:assert/strict";
import { discordAvatarUrl, fetchAvatarDataUri } from "./avatar";

test("discordAvatarUrl : URL CDN + taille par défaut / custom", () => {
  assert.equal(discordAvatarUrl("123", "abc"), "https://cdn.discordapp.com/avatars/123/abc.png?size=256");
  assert.equal(discordAvatarUrl("123", "abc", 64), "https://cdn.discordapp.com/avatars/123/abc.png?size=64");
});

test("fetchAvatarDataUri : succès → data URI base64", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const fetchImpl = (async () =>
    new Response(bytes, { headers: { "content-type": "image/png" } })) as unknown as typeof fetch;
  const uri = await fetchAvatarDataUri("1", "h", { fetchImpl });
  assert.equal(uri, `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`);
});

test("fetchAvatarDataUri : réponse non-ok → null (carte dégradée)", async () => {
  const fetchImpl = (async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
  assert.equal(await fetchAvatarDataUri("1", "h", { fetchImpl }), null);
});

test("fetchAvatarDataUri : fetch qui échoue → null (best-effort, jamais bloquant)", async () => {
  const fetchImpl = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  assert.equal(await fetchAvatarDataUri("1", "h", { fetchImpl }), null);
});

test("fetchAvatarDataUri : corps vide → null", async () => {
  const fetchImpl = (async () =>
    new Response(new Uint8Array([]), {
      headers: { "content-type": "image/png" },
    })) as unknown as typeof fetch;
  assert.equal(await fetchAvatarDataUri("1", "h", { fetchImpl }), null);
});
