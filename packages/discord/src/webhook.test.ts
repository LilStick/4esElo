import { test } from "node:test";
import assert from "node:assert/strict";
import { DiscordWebhookClient } from "./webhook";
import { DiscordError } from "./oauth";

function captureFetch() {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

test("send: POST l'embed avec allowed_mentions vide (anti-ping @everyone)", async () => {
  const { calls, fetchImpl } = captureFetch();
  const wh = new DiscordWebhookClient("https://discord.test/webhook/xyz", { fetchImpl });
  await wh.send({ title: "💡 Idée", description: "@everyone un dark mode", footer: "par Noé" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "https://discord.test/webhook/xyz");
  const body = calls[0]!.body as {
    embeds: { title: string; description: string; footer: { text: string } }[];
    allowed_mentions: { parse: string[] };
  };
  assert.deepEqual(body.allowed_mentions, { parse: [] }); // ne ping personne
  assert.equal(body.embeds[0]!.description, "@everyone un dark mode"); // texte préservé
  assert.equal(body.embeds[0]!.footer.text, "par Noé");
});

test("send: statut non-ok → DiscordError", async () => {
  const fetchImpl = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
  const wh = new DiscordWebhookClient("https://discord.test/webhook/xyz", { fetchImpl });
  await assert.rejects(() => wh.send({ description: "x" }), DiscordError);
});

test("constructor: URL vide → throw", () => {
  assert.throws(() => new DiscordWebhookClient(""));
});
