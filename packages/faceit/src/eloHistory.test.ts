import { test } from "node:test";
import assert from "node:assert/strict";
import { FaceitError } from "./client";
import { UnofficialEloHistory, eloToLevel } from "./eloHistory";

const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("parses entries, filters unranked ones (no elo), normalizes numbers", async () => {
  const fetchImpl = (async () =>
    jsonRes([
      { matchId: "m1", date: 1751000000000, elo: "1702", elo_delta: "-29" },
      { matchId: "m2", date: 1750000000000 }, // unranked → filtered
      { date: 1749000000000, elo: "1731" }, // no matchId → kept
    ])) as typeof fetch;
  const provider = new UnofficialEloHistory({ fetchImpl });
  const points = await provider.getEloHistory("fid");

  assert.equal(points.length, 2);
  assert.deepEqual(points[0], {
    matchId: "m1",
    elo: 1702,
    eloDelta: -29,
    date: new Date(1751000000000),
  });
  assert.equal(points[1]!.matchId, null);
  assert.equal(points[1]!.eloDelta, null);
});

test("paginates until a short page, throttling between pages", async () => {
  const pages = [
    Array.from({ length: 3 }, (_, i) => ({ matchId: `a${i}`, date: 1, elo: "1500" })),
    [{ matchId: "b0", date: 1, elo: "1510" }],
  ];
  let sleeps = 0;
  const urls: string[] = [];
  const provider = new UnofficialEloHistory({
    pageSize: 3,
    fetchImpl: (async (url: Parameters<typeof fetch>[0]) => {
      urls.push(String(url));
      return jsonRes(pages[urls.length - 1] ?? []);
    }) as typeof fetch,
    sleep: async () => {
      sleeps += 1;
    },
  });
  const points = await provider.getEloHistory("fid");

  assert.equal(points.length, 4);
  assert.equal(urls.length, 2);
  assert.ok(urls[0]!.includes("page=0") && urls[1]!.includes("page=1"));
  assert.equal(sleeps, 1); // between the two pages only
});

test("403 (Cloudflare) throws a FaceitError for the caller to degrade", async () => {
  const provider = new UnofficialEloHistory({
    fetchImpl: (async () => new Response("<html>blocked</html>", { status: 403 })) as typeof fetch,
  });
  await assert.rejects(() => provider.getEloHistory("fid"), FaceitError);
});

test("eloToLevel maps the official ranges", () => {
  assert.equal(eloToLevel(500), 1);
  assert.equal(eloToLevel(800), 1);
  assert.equal(eloToLevel(801), 2);
  assert.equal(eloToLevel(1364), 5);
  assert.equal(eloToLevel(2000), 9);
  assert.equal(eloToLevel(2001), 10);
  assert.equal(eloToLevel(3100), 10);
});
