import { test } from "node:test";
import assert from "node:assert/strict";
import { SteamClient } from "./client";

const jsonRes = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

function apiFetch(players: unknown[]): { fetch: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    fetch: (async (url: Parameters<typeof fetch>[0]) => {
      urls.push(String(url));
      return jsonRes({ response: { players } });
    }) as typeof fetch,
  };
}

test("API mode: maps states, CS2 detection and community server from one batched call", async () => {
  const { fetch, urls } = apiFetch([
    { steamid: "1", personastate: 1, gameid: "730", gameserverip: "51.68.1.2:27015" },
    { steamid: "2", personastate: 1, gameid: "730" },
    { steamid: "3", personastate: 0 },
    { steamid: "4", personastate: 1, gameid: "440" },
  ]);
  const client = new SteamClient({ apiKey: "k", fetchImpl: fetch });
  const res = await client.getPresence(["1", "2", "3", "4"]);

  assert.equal(urls.length, 1); // one batch
  assert.ok(urls[0]!.includes("steamids=1%2C2%2C3%2C4") || urls[0]!.includes("steamids=1,2,3,4"));
  assert.deepEqual(res[0], { steamId64: "1", online: true, inGameCs2: true, onCommunityServer: true });
  assert.deepEqual(res[1], { steamId64: "2", online: true, inGameCs2: true, onCommunityServer: false });
  assert.deepEqual(res[2], { steamId64: "3", online: false, inGameCs2: false, onCommunityServer: null });
  assert.equal(res[3]!.inGameCs2, false); // playing another game
});

test("API mode: player omitted by Steam (private) → online null, not offline", async () => {
  const { fetch } = apiFetch([{ steamid: "1", personastate: 1 }]);
  const client = new SteamClient({ apiKey: "k", fetchImpl: fetch });
  const res = await client.getPresence(["1", "ghost"]);

  assert.deepEqual(res[1], { steamId64: "ghost", online: null, inGameCs2: false, onCommunityServer: null });
});

const xml = (state: string, message: string) =>
  new Response(
    `<?xml version="1.0"?><profile><onlineState>${state}</onlineState><stateMessage><![CDATA[${message}]]></stateMessage></profile>`,
    { status: 200 },
  );

test("XML mode (no key): in-game CS2, online, offline - community server unknown", async () => {
  const responses: Record<string, Response> = {
    "11": xml("in-game", "In-Game<br/>Counter-Strike 2"),
    "22": xml("online", "Online"),
    "33": xml("offline", "Offline"),
  };
  const client = new SteamClient({
    fetchImpl: (async (url: Parameters<typeof fetch>[0]) => {
      const id = /profiles\/(\w+)\//.exec(String(url))![1]!;
      return responses[id]!.clone();
    }) as typeof fetch,
  });
  const res = await client.getPresence(["11", "22", "33"]);

  assert.deepEqual(res[0], { steamId64: "11", online: true, inGameCs2: true, onCommunityServer: null });
  assert.deepEqual(res[1], { steamId64: "22", online: true, inGameCs2: false, onCommunityServer: null });
  assert.deepEqual(res[2], { steamId64: "33", online: false, inGameCs2: false, onCommunityServer: null });
});

test("XML mode: fetch failure on one profile → null for that one, others unaffected", async () => {
  const client = new SteamClient({
    fetchImpl: (async (url: Parameters<typeof fetch>[0]) => {
      if (String(url).includes("bad")) throw new Error("boom");
      return xml("online", "Online").clone();
    }) as typeof fetch,
  });
  const res = await client.getPresence(["ok", "bad"]);

  assert.equal(res[0]!.online, true);
  assert.deepEqual(res[1], { steamId64: "bad", online: null, inGameCs2: false, onCommunityServer: null });
});
