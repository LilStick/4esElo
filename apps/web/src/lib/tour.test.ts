import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bubbleWidth, isMobileViewport, resolveTarget } from "./tour";

const M = 14; // marge écran utilisée par le Tour

describe("bubbleWidth", () => {
  it("ne dépasse jamais la largeur de l'écran, marges comprises (régression mobile)", () => {
    for (const vw of [320, 360, 375, 414, 768, 1024, 1440]) {
      assert.ok(bubbleWidth(vw, M) <= vw - M * 2, `déborde à ${vw}px`);
      assert.ok(bubbleWidth(vw, M) >= 0);
    }
  });

  it("reste plafonnée à 340px sur grand écran", () => {
    assert.equal(bubbleWidth(1440, M), 340);
    assert.equal(bubbleWidth(1024, M), 340);
  });

  it("rétrécit sous le plafond sur petit écran", () => {
    assert.equal(bubbleWidth(320, M), 320 - M * 2); // 292
    assert.equal(bubbleWidth(360, M), 360 - M * 2); // 332
  });
});

describe("isMobileViewport", () => {
  it("bascule à la borne lg (1024px)", () => {
    assert.equal(isMobileViewport(1023), true);
    assert.equal(isMobileViewport(1024), false);
  });
});

describe("resolveTarget", () => {
  const nav = { target: '[data-tour="nav"]', targetMobile: '[data-tour="nav-mobile"]' };
  const ladder = { target: '[data-tour="ladder"]' }; // présent aux deux breakpoints
  const auth = { target: '[data-tour="auth"]', targetMobile: null }; // drawer-only -> centré

  it("desktop : utilise toujours la cible desktop", () => {
    assert.equal(resolveTarget(nav, false), '[data-tour="nav"]');
    assert.equal(resolveTarget(auth, false), '[data-tour="auth"]');
  });

  it("mobile : préfère la cible mobile dédiée", () => {
    assert.equal(resolveTarget(nav, true), '[data-tour="nav-mobile"]');
  });

  it("mobile : `null` force une bulle centrée (pas de spotlight sur un élément caché)", () => {
    assert.equal(resolveTarget(auth, true), undefined);
  });

  it("mobile : sans cible mobile dédiée, retombe sur la cible commune", () => {
    assert.equal(resolveTarget(ladder, true), '[data-tour="ladder"]');
  });
});
