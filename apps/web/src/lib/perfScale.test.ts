import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { perfScale } from "./perfScale";

describe("perfScale", () => {
  it("graduations à valeurs rondes (multiples du pas)", () => {
    const { ticks, step } = perfScale([1250, 1300, 1280, 1340, 1360]);
    assert.ok(ticks.length >= 2 && ticks.length <= 6);
    for (const t of ticks) assert.equal(t % step, 0, `${t} pas multiple de ${step}`);
  });

  it("toutes les valeurs restent dans le domaine", () => {
    const values = [21000, 21150, 21080, 21320];
    const { lo, hi } = perfScale(values);
    assert.ok(lo <= Math.min(...values));
    assert.ok(hi >= Math.max(...values));
  });

  it("dernier point à peu près au milieu du domaine", () => {
    // Courbe montante : sans centrage, la fin serait collée en haut.
    const values = [1200, 1240, 1300, 1360, 1420];
    const { lo, hi } = perfScale(values);
    const last = values[values.length - 1]!;
    const pos = (last - lo) / (hi - lo); // 0 = bas, 1 = haut
    assert.ok(pos > 0.3 && pos < 0.7, `dernier à ${pos.toFixed(2)} du bas`);
  });

  it("ELO plat → domaine encadrant, pas de division par zéro", () => {
    const { lo, hi, ticks } = perfScale([2000, 2000, 2000]);
    assert.ok(hi > lo);
    assert.ok(ticks.includes(2000));
  });

  it("gros ratings Premier : pas de 100, ~centré", () => {
    const { step, ticks } = perfScale([21200, 21250, 21300, 21350]);
    assert.ok(step >= 50);
    for (const t of ticks) assert.equal(t % step, 0);
  });
});
