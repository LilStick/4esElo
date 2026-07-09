import { test } from "node:test";
import assert from "node:assert/strict";
import { eloToAttribute } from "./eloAfter";
import type { SyncResult } from "./sync";

test("attribue l'ELO dès qu'un changement est enregistré", () => {
  const recorded: SyncResult = { status: "recorded", elo: 2092, previous: 2067, level: 10 };
  assert.equal(eloToAttribute(recorded), 2092);
});

test("pas d'attribution si l'ELO n'a pas changé", () => {
  assert.equal(eloToAttribute({ status: "unchanged", elo: 2067 }), null);
});

test("pas d'attribution sur no-cs2 / not-found", () => {
  assert.equal(eloToAttribute({ status: "no-cs2" }), null);
  assert.equal(eloToAttribute({ status: "not-found" }), null);
});
