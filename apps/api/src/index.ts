import { API_PORT } from "./env";
import { serve } from "@hono/node-server";
import { runMigrations, shouldMigrateOnBoot } from "@4eselo/db";
import { app } from "./app";

// Schéma à jour AVANT de servir (B11.18). Fail fast : jamais servir sur un schéma
// incohérent. Gaté par DB_MIGRATE_ON_BOOT (on en prod ; off en dev/CI = db:push).
if (shouldMigrateOnBoot()) {
  try {
    await runMigrations();
    console.log("[db] migrations à jour");
  } catch (err) {
    console.error("[db] migrations échouées, démarrage refusé:", err);
    process.exit(1);
  }
}

serve({ fetch: app.fetch, port: API_PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
