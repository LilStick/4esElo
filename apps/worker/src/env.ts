import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadEnv } from "@4eselo/env";

// Load the monorepo-root .env regardless of the process cwd.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });

// Single access point for env vars — `process.env` is forbidden elsewhere
// (lint), and the worker refuses to start half-configured (B11.3).
const env = loadEnv(
  z.object({
    DATABASE_URL: z.string().url({ message: "URL Postgres attendue (voir .env.example)" }),
    FACEIT_API_KEY: z.string().min(1, "clé server-side requise — https://developers.faceit.com"),
    STEAM_API_KEY: z.string().optional(),
    WORKER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 60 * 1000),
  }),
);

export const FACEIT_API_KEY = env.FACEIT_API_KEY;
export const STEAM_API_KEY = env.STEAM_API_KEY;
export const WORKER_INTERVAL_MS = env.WORKER_INTERVAL_MS;
