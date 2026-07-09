import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Charge le .env racine (DATABASE_URL…) pour les tests/scripts, sans la
// validation stricte de env.ts (qui exige FACEIT_API_KEY, absent en CI). À
// importer AVANT @4eselo/db pour que le client voie DATABASE_URL. N'écrase pas
// une variable déjà présente (CI : DATABASE_URL vient de l'environnement du job).
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });
