import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isEloSource, otherSource, sourceLabel } from "./eloSource";

describe("isEloSource", () => {
  it("accepte faceit/premier, rejette le reste", () => {
    assert.equal(isEloSource("faceit"), true);
    assert.equal(isEloSource("premier"), true);
    assert.equal(isEloSource("nope"), false);
    assert.equal(isEloSource(null), false);
    assert.equal(isEloSource(undefined), false);
  });
});

describe("otherSource", () => {
  it("bascule binaire", () => {
    assert.equal(otherSource("faceit"), "premier");
    assert.equal(otherSource("premier"), "faceit");
  });
});

describe("sourceLabel", () => {
  it("libellés humains", () => {
    assert.equal(sourceLabel("faceit"), "Faceit");
    assert.equal(sourceLabel("premier"), "Premier");
  });
});
