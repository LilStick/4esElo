import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clampPage, pageCountOf, pageWindow } from "./pagination";

describe("pageCountOf", () => {
  it("arrondit au supérieur, minimum 1", () => {
    assert.equal(pageCountOf(0, 10), 1);
    assert.equal(pageCountOf(10, 10), 1);
    assert.equal(pageCountOf(11, 10), 2);
    assert.equal(pageCountOf(25, 10), 3);
  });
  it("gère size <= 0 sans planter", () => {
    assert.equal(pageCountOf(10, 0), 10);
  });
});

describe("clampPage", () => {
  it("borne dans [0, count-1]", () => {
    assert.equal(clampPage(-3, 5), 0);
    assert.equal(clampPage(9, 5), 4);
    assert.equal(clampPage(2, 5), 2);
  });
});

describe("pageWindow", () => {
  it("liste courte : toutes les pages", () => {
    assert.deepEqual(pageWindow(0, 3), [1, 2, 3]);
  });
  it("une seule page", () => {
    assert.deepEqual(pageWindow(0, 1), [1]);
  });
  it("insère des ellipses autour de la page courante", () => {
    // page=5 (0-based) → courante 6 (1-based), voisins 5/6/7
    assert.deepEqual(pageWindow(5, 12, 1), [1, "…", 5, 6, 7, "…", 12]);
  });
  it("pas d'ellipse quand les bornes se touchent", () => {
    assert.deepEqual(pageWindow(1, 4, 1), [1, 2, 3, 4]);
  });
});
