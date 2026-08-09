import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isEloSource, otherSource, resolveSource, sourceLabel } from "./eloSource";

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

describe("resolveSource", () => {
  it("priorité à l'URL quand valide, sinon la préférence stockée", () => {
    assert.equal(resolveSource("premier", "faceit", true), "premier");
    assert.equal(resolveSource("faceit", "premier", true), "faceit");
    assert.equal(resolveSource(null, "premier", true), "premier");
    assert.equal(resolveSource("nope", "premier", true), "premier");
  });

  it("clampe sur faceit quand Premier est off (régression #479)", () => {
    // Lien partagé ?source=premier avec le flag off → on ne doit PAS rester bloqué en Premier.
    assert.equal(resolveSource("premier", "faceit", false), "faceit");
    // localStorage resté sur premier + flag off → faceit aussi.
    assert.equal(resolveSource(null, "premier", false), "faceit");
    // Faceit demandé + flag off → faceit (inchangé).
    assert.equal(resolveSource("faceit", "faceit", false), "faceit");
  });
});
