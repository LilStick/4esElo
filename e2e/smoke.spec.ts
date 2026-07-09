import { test, expect } from "@playwright/test";

/**
 * Smoke SPA : on prouve juste que l'app monte dans un vrai navigateur (pas
 * d'écran blanc, pas de crash au boot). VOLONTAIREMENT pas de parcours métier ni
 * d'assertion sur le DOM interne : le front bouge jusqu'à la v1. Quand il se
 * fige, on ajoutera ici des parcours (classement → profil → courbe, etc.).
 */
test("la home monte sans crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page).toHaveTitle(/4esElo/);
  // React a bien rendu quelque chose dans #root (pas d'écran blanc).
  await expect(page.locator("#root")).not.toBeEmpty();
  expect(errors, `erreurs JS au boot : ${errors.join(" · ")}`).toEqual([]);
});
