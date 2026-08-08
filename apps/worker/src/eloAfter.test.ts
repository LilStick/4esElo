import { test } from "node:test";
import assert from "node:assert/strict";
import { eloToAttribute } from "./eloAfter";
import type { SyncResult } from "./sync";

test("attribue l'ELO dès qu'un changement est enregistré", () => {
  const recorded: SyncResult = {
    status: "recorded",
    elo: 2092,
    previous: 2067,
    level: 10,
    steamIdFilled: false,
  };
  assert.equal(eloToAttribute(recorded), 2092);
});

// Non-régression (#439) : le ±ELO du dernier match était perdu quand les stats Faceit
// sortaient APRÈS le changement d'ELO. L'ELO courant reste l'elo_after du dernier match
// même sans changement ce tick → on le renvoie pour le rattraper.
test("réattribue l'ELO courant même si inchangé (rattrape le dernier match)", () => {
  assert.equal(eloToAttribute({ status: "unchanged", elo: 2067, steamIdFilled: false }), 2067);
});

test("pas d'attribution en placement (unranked), no-cs2 ou not-found", () => {
  assert.equal(eloToAttribute({ status: "unranked", steamIdFilled: false }), null);
  assert.equal(eloToAttribute({ status: "no-cs2" }), null);
  assert.equal(eloToAttribute({ status: "not-found" }), null);
});
