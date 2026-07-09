import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * Socle e2e (B11.17). Deux projets :
 *  - `api`   : e2e HTTP réel contre l'API bootée (fixture `request`, sans navigateur).
 *  - `smoke` : la SPA monte dans un vrai Chromium.
 * `webServer` boote API (:3001) + web (:5173) ; la Postgres de test est externe
 * (service CI / `pnpm db:up` en local). Le seed vit dans e2e/global-setup.
 * Pas de parcours UI métier ici : le front bouge jusqu'à la v1 (cf. ticket).
 */
const API = "http://localhost:3001";
const WEB = "http://localhost:5173";
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? "line" : "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  projects: [
    { name: "api", testMatch: /api\.spec\.ts/, use: { baseURL: API } },
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: WEB },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @4eselo/api start",
      url: `${API}/health`,
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @4eselo/web dev",
      url: WEB,
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
  ],
});
