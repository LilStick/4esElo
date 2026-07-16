import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Charge le .env racine (DATABASE_URL…) pour tests/scripts, sans la validation
// stricte d'env.ts (FACEIT_API_KEY absent en CI). À importer AVANT @4eselo/db.
// N'écrase pas une var déjà présente (CI : DATABASE_URL vient du job).
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });
