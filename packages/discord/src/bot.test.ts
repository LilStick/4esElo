import { test } from "node:test";
import assert from "node:assert/strict";
import { DiscordBotClient } from "./bot";

type Call = { url: string; init: RequestInit };

function recordingFetch(response: () => Response): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return response();
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

test("postMessage : POST /channels/:id/messages, auth bot, mentions neutralisées → renvoie l'id", async () => {
  const { fetchImpl, calls } = recordingFetch(
    () => new Response(JSON.stringify({ id: "msg-1" }), { status: 200 }),
  );
  const bot = new DiscordBotClient("tok", { fetchImpl });
  const id = await bot.postMessage("chan-1", { title: "💡", description: "hello", footer: "par X" });

  assert.equal(id, "msg-1");
  assert.match(calls[0]!.url, /\/channels\/chan-1\/messages$/);
  assert.equal(calls[0]!.init.method, "POST");
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Bot tok");
  const body = JSON.parse(calls[0]!.init.body as string);
  assert.deepEqual(body.allowed_mentions, { parse: [] });
  assert.equal(body.embeds[0].description, "hello");
});

test("react : PUT sur l'emoji URL-encodé + /@me", async () => {
  const { fetchImpl, calls } = recordingFetch(() => new Response(null, { status: 204 }));
  const bot = new DiscordBotClient("tok", { fetchImpl });
  await bot.react("chan-1", "msg-1", "✅");

  assert.equal(calls[0]!.init.method, "PUT");
  assert.match(calls[0]!.url, /\/channels\/chan-1\/messages\/msg-1\/reactions\/%E2%9C%85\/@me$/);
});

test("réponse non-ok → DiscordError", async () => {
  const { fetchImpl } = recordingFetch(() => new Response("nope", { status: 403 }));
  const bot = new DiscordBotClient("tok", { fetchImpl });
  await assert.rejects(() => bot.postMessage("c", { description: "x" }));
});

test("token vide → refuse de construire", () => {
  assert.throws(() => new DiscordBotClient(""));
});
