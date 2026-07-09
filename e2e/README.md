# e2e — socle Playwright (B11.17)

Tests de bout en bout contre la **vraie stack** (API + web + Postgres bootés
ensemble), en complément des tests unitaires et d'intégration.

## Lancer

```bash
pnpm db:up        # Postgres (si pas déjà lancé)
pnpm e2e          # boote API + web automatiquement, puis lance les tests
```

Playwright démarre les serveurs tout seul (`webServer` dans `playwright.config.ts`)
et réutilise ceux déjà lancés en local. Les données de seed (un joueur à id fixe,
sa courbe et quelques matchs) sont insérées avant la suite et nettoyées après
(`e2e/seed.ts`, `global-setup` / `global-teardown`).

## Ce qu'on teste (et ce qu'on ne teste pas)

- **`api.spec.ts`** — l'API en **HTTP réel** (fixture `request`, sans navigateur) :
  boot du serveur, montage des routes, headers, CORS. C'est le cœur du socle.
- **`smoke.spec.ts`** — la SPA **monte** dans un vrai Chromium (pas d'écran blanc).

**Pas de parcours UI métier** pour l'instant : le front bouge jusqu'à la v1,
tester le DOM maintenant = tests fragiles à réécrire.

## Ajouter un parcours plus tard (quand la v1 sera figée)

Créer `e2e/<parcours>.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

test("classement → profil → courbe", async ({ page }) => {
  await page.goto("/classement");
  await page.getByText("e2e_seed_player").click();
  await expect(page.getByRole("heading", { name: /e2e_seed_player/ })).toBeVisible();
});
```

Le socle (serveurs, seed, CI) est déjà en place : il n'y a qu'à écrire le `.spec.ts`.
