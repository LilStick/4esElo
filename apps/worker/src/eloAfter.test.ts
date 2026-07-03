import { test } from "node:test";
import assert from "node:assert/strict";
import { attributeEloAfter } from "./eloAfter";
import type { IngestResult } from "./ingest";
import type { SyncResult } from "./sync";

const ingest = (ids: string[]): IngestResult => ({
  scanned: ids.length,
  inserted: ids.length,
  skipped: 0,
  failed: 0,
  insertedMatchIds: ids,
});

const recorded: SyncResult = { status: "recorded", elo: 2092, previous: 2067, level: 10 };

test("attributes the tick's ELO when exactly one new match and ELO changed", () => {
  assert.deepEqual(attributeEloAfter(recorded, ingest(["m1"])), { matchId: "m1", elo: 2092 });
});

test("no attribution when the ELO did not change", () => {
  assert.equal(attributeEloAfter({ status: "unchanged", elo: 2067 }, ingest(["m1"])), null);
});

test("no attribution when no new match was ingested", () => {
  assert.equal(attributeEloAfter(recorded, ingest([])), null);
});

test("no attribution when several new matches are candidates (ambiguous)", () => {
  assert.equal(attributeEloAfter(recorded, ingest(["m1", "m2"])), null);
});

test("no attribution on no-cs2 / not-found sync results", () => {
  assert.equal(attributeEloAfter({ status: "no-cs2" }, ingest(["m1"])), null);
  assert.equal(attributeEloAfter({ status: "not-found" }, ingest(["m1"])), null);
});
