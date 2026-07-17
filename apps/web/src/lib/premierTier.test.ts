import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { premierTier } from "./premierTier";

describe("premierTier", () => {
  it("mappe chaque bande de 5000 à la bonne couleur", () => {
    assert.equal(premierTier(0).name, "grey");
    assert.equal(premierTier(4999).name, "grey");
    assert.equal(premierTier(5000).name, "sky");
    assert.equal(premierTier(9999).name, "sky");
    assert.equal(premierTier(10000).name, "blue");
    assert.equal(premierTier(14999).name, "blue");
    assert.equal(premierTier(15000).name, "purple");
    assert.equal(premierTier(20000).name, "pink");
    assert.equal(premierTier(25000).name, "red");
    assert.equal(premierTier(30000).name, "gold");
    assert.equal(premierTier(33800).color, "#FED700");
  });

  it("clamp les valeurs négatives à grey", () => {
    assert.equal(premierTier(-100).name, "grey");
  });
});
