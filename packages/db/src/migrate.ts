import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Applique les migrations Drizzle en attente (B11.18). Pensé pour tourner AU BOOT
 * de l'app en prod (Coolify n'a ni terminal ni pre-deploy command) → un deploy
 * applique toujours son schéma, plus de drift code↔DB (incident is_admin du 08/08 :
 * migration mergée jamais appliquée → 500 au redeploy suivant).
 *
 * Gaté par `DB_MIGRATE_ON_BOOT` (off par défaut) : le dev/CI initialisent la DB via
 * `db:push` (pas de journal de migrations) → migrer là planterait. On l'active donc
 * UNIQUEMENT en prod (DB initialisée par migrations).
 */

// Dossier des migrations versionnées, résolu relativement à ce fichier (les apps
// tournent en `tsx src/…` → chemin source valide aussi en prod).
const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");

// Clé arbitraire mais fixe : advisory lock Postgres pour sérialiser api+worker qui
// démarrent en même temps (un seul migre, l'autre attend puis voit 0 en attente).
const LOCK_KEY = 4200_0418;

/** true si on doit migrer au boot (prod). Pur, testable. */
export function shouldMigrateOnBoot(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DB_MIGRATE_ON_BOOT === "true";
}

/** Applique les migrations en attente sous advisory lock. Idempotent (no-op si à jour). */
export async function runMigrations(
  url: string | undefined = process.env.DATABASE_URL,
  migrationsFolder: string = MIGRATIONS_FOLDER,
): Promise<void> {
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1 });
  try {
    await client`select pg_advisory_lock(${LOCK_KEY})`;
    try {
      await migrate(drizzle(client), { migrationsFolder });
    } finally {
      await client`select pg_advisory_unlock(${LOCK_KEY})`;
    }
  } finally {
    await client.end();
  }
}
