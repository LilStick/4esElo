import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadEnv } from "@4eselo/env";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });

// Point d'accès unique aux env vars (process.env interdit ailleurs par lint) ;
// le worker refuse de démarrer mal configuré (B11.3).
const env = loadEnv(
  z.object({
    DATABASE_URL: z.string().url({ message: "URL Postgres attendue (voir .env.example)" }),
    FACEIT_API_KEY: z.string().min(1, "clé server-side requise - https://developers.faceit.com"),
    STEAM_API_KEY: z.string().optional(),
    WORKER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 60 * 1000),
    // V2 Premier (B18) - optionnels : dormant tant que PREMIER_ENABLED != "true".
    PREMIER_ENABLED: z.string().default("false"),
    STEAM_BOT_USERNAME: z.string().optional(),
    STEAM_BOT_PASSWORD: z.string().optional(),
    STEAM_BOT_SHARED_SECRET: z.string().optional(),
    STEAM_AUTH_ENC_KEY: z.string().length(64).optional(),
  }),
);

export const FACEIT_API_KEY = env.FACEIT_API_KEY;
export const STEAM_API_KEY = env.STEAM_API_KEY;
export const WORKER_INTERVAL_MS = env.WORKER_INTERVAL_MS;
export const PREMIER_ENABLED = env.PREMIER_ENABLED.toLowerCase() === "true";
export const STEAM_BOT_USERNAME = env.STEAM_BOT_USERNAME;
export const STEAM_BOT_PASSWORD = env.STEAM_BOT_PASSWORD;
export const STEAM_BOT_SHARED_SECRET = env.STEAM_BOT_SHARED_SECRET;
export const STEAM_AUTH_ENC_KEY = env.STEAM_AUTH_ENC_KEY;
