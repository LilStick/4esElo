import { test } from "node:test";
import assert from "node:assert/strict";
import { eloToAttribute } from "./eloAfter";
import type { SyncResult } from "./sync";

test("attribue l'ELO dès qu'un changement est enregistré", () => {
  const recorded: SyncResult = { status: "recorded", elo: 2092, previous: 2067, level: 10 };
  assert.equal(eloToAttribute(recorded), 2092);
});

// Non-régression : le ±ELO du dernier match était perdu quand les stats Faceit du
// match sortaient APRÈS le changement d'ELO (attribution ratée, jamais rejouée).
// L'ELO courant reste l'elo_after du dernier match même sans changement ce tick → on
// le renvoie pour le rattraper (setNewestMatchEloAfter ne remplit que si c'est vide).
test("réattribue l'ELO courant même si inchangé (rattrape le dernier match)", () => {
  assert.equal(eloToAttribute({ status: "unchanged", elo: 2067 }), 2067);
});

test("pas d'attribution sur no-cs2 / not-found", () => {
  assert.equal(eloToAttribute({ status: "no-cs2" }), null);
  assert.equal(eloToAttribute({ status: "not-found" }), null);
});
