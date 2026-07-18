import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasInAppHistory } from "./nav";

describe("hasInAppHistory", () => {
  it("faux pour l'entrée initiale (atterrissage direct / lien partagé / reload)", () => {
    assert.equal(hasInAppHistory("default"), false);
  });
  it("vrai dès qu'une navigation interne a eu lieu (clé non « default »)", () => {
    assert.equal(hasInAppHistory("ab12cd"), true);
    assert.equal(hasInAppHistory("x"), true);
  });
});
