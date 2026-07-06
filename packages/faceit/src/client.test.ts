import { test } from "node:test";
import assert from "node:assert/strict";
import { FaceitClient, FaceitError, FaceitNotFoundError } from "./client";

// A fake fetch that returns a canned Response and records the last request.
function fakeFetch(response: Response) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, headers });
    return response.clone();
  }) as typeof fetch;
  return { impl, calls };
}

const PLAYER_PAYLOAD = {
  player_id: "abc-123",
  nickname: "s1mple_wannabe",
  avatar: "https://img/avatar.jpg",
  country: "fr",
  games: {
    cs2: {
      region: "EU",
      game_player_id: "76561198000000000",
      game_player_name: "noe",
      skill_level: 8,
      faceit_elo: 1875,
    },
  },
};

test("getPlayerByNickname normalizes the CS2 profile", async () => {
  const { impl, calls } = fakeFetch(new Response(JSON.stringify(PLAYER_PAYLOAD)));
  const client = new FaceitClient("key-xyz", { fetchImpl: impl });

  const player = await client.getPlayerByNickname("s1mple_wannabe");

  assert.equal(player.playerId, "abc-123");
  assert.equal(player.nickname, "s1mple_wannabe");
  assert.deepEqual(player.cs2, {
    elo: 1875,
    skillLevel: 8,
    steamId64: "76561198000000000",
  });

  // sends the API key and the right query params
  assert.equal(calls[0]!.headers.Authorization, "Bearer key-xyz");
  assert.match(calls[0]!.url, /nickname=s1mple_wannabe/);
  assert.match(calls[0]!.url, /game=cs2/);
});

test("getPlayerByNickname returns cs2=null when player has no CS2", async () => {
  const payload = { player_id: "x", nickname: "lol_only", games: {} };
  const { impl } = fakeFetch(new Response(JSON.stringify(payload)));
  const client = new FaceitClient("k", { fetchImpl: impl });

  const player = await client.getPlayerByNickname("lol_only");
  assert.equal(player.cs2, null);
});

test("a 404 throws FaceitNotFoundError", async () => {
  const { impl } = fakeFetch(new Response("nope", { status: 404 }));
  const client = new FaceitClient("k", { fetchImpl: impl });

  await assert.rejects(() => client.getPlayerByNickname("ghost"), FaceitNotFoundError);
});

test("getMatchHistory normalizes items and converts timestamps", async () => {
  const payload = {
    items: [
      { match_id: "m1", game_id: "cs2", started_at: 1_700_000_000, finished_at: 1_700_003_600 },
      { match_id: "m2", game_id: "cs2", started_at: 1_699_000_000 },
    ],
    start: 0,
    end: 2,
  };
  const { impl } = fakeFetch(new Response(JSON.stringify(payload)));
  const client = new FaceitClient("k", { fetchImpl: impl });

  const matches = await client.getMatchHistory("abc-123", { limit: 2 });

  assert.equal(matches.length, 2);
  assert.equal(matches[0]!.matchId, "m1");
  assert.equal(matches[0]!.startedAt.getTime(), 1_700_000_000 * 1000);
  assert.equal(matches[0]!.finishedAt?.getTime(), 1_700_003_600 * 1000);
  assert.equal(matches[1]!.finishedAt, null);
});

// ——— B11.2 : timeout, retry & backoff ———

function flaky(responses: (Response | Error)[]): { fetch: typeof fetch; calls: number } {
  const state = { calls: 0 };
  const f = (async () => {
    const r = responses[Math.min(state.calls, responses.length - 1)]!;
    state.calls += 1;
    if (r instanceof Error) throw r;
    return r.clone();
  }) as typeof fetch;
  return {
    fetch: f,
    get calls() {
      return state.calls;
    },
  };
}

const okPlayer = () =>
  new Response(
    JSON.stringify({
      player_id: "fc-1",
      nickname: "noe",
      games: { cs2: { skill_level: 8, faceit_elo: 1800 } },
    }),
    { status: 200 },
  );
const noSleepOpts = { sleep: async () => {} };

test("B11.2: retries a 503 then succeeds", async () => {
  const mock = flaky([new Response("oops", { status: 503 }), okPlayer()]);
  const client = new FaceitClient("k", { fetchImpl: mock.fetch, ...noSleepOpts });
  const p = await client.getPlayerById("fc-1");
  assert.equal(p.nickname, "noe");
  assert.equal(mock.calls, 2);
});

test("B11.2: respects Retry-After on 429", async () => {
  const sleeps: number[] = [];
  const mock = flaky([
    new Response("slow down", { status: 429, headers: { "Retry-After": "2" } }),
    okPlayer(),
  ]);
  const client = new FaceitClient("k", {
    fetchImpl: mock.fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  await client.getPlayerById("fc-1");
  assert.deepEqual(sleeps, [2000]);
});

test("B11.2: network errors are retried", async () => {
  const mock = flaky([new Error("ECONNRESET"), okPlayer()]);
  const client = new FaceitClient("k", { fetchImpl: mock.fetch, ...noSleepOpts });
  await client.getPlayerById("fc-1");
  assert.equal(mock.calls, 2);
});

test("B11.2: exhausted retries throw the last FaceitError", async () => {
  const mock = flaky([new Response("down", { status: 503 })]);
  const client = new FaceitClient("k", { fetchImpl: mock.fetch, maxAttempts: 3, ...noSleepOpts });
  await assert.rejects(
    () => client.getPlayerById("fc-1"),
    (e: FaceitError) => e instanceof FaceitError && e.status === 503,
  );
  assert.equal(mock.calls, 3);
});

test("B11.2: 404 and other 4xx are NOT retried", async () => {
  const notFound = flaky([new Response("nope", { status: 404 })]);
  const c1 = new FaceitClient("k", { fetchImpl: notFound.fetch, ...noSleepOpts });
  await assert.rejects(() => c1.getPlayerById("x"), FaceitNotFoundError);
  assert.equal(notFound.calls, 1);

  const forbidden = flaky([new Response("bad key", { status: 403 })]);
  const c2 = new FaceitClient("k", { fetchImpl: forbidden.fetch, ...noSleepOpts });
  await assert.rejects(() => c2.getPlayerById("x"), FaceitError);
  assert.equal(forbidden.calls, 1);
});
