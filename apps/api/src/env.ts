import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadEnv } from "@4eselo/env";

// Load the monorepo-root .env regardless of the process cwd.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });

// Single access point for env vars — `process.env` is forbidden elsewhere
// (lint), and the app refuses to start half-configured (B11.3).
const env = loadEnv(
  z.object({
    DATABASE_URL: z.string().url({ message: "URL Postgres attendue (voir .env.example)" }),
    API_PORT: z.coerce.number().int().positive().default(3001),
    STEAM_API_KEY: z.string().optional(),
    WEB_ORIGINS: z.string().default("http://localhost:5173"),
  }),
);

export const API_PORT = env.API_PORT;
export const STEAM_API_KEY = env.STEAM_API_KEY;
/** Origines autorisées par le CORS, séparées par des virgules. */
export const WEB_ORIGINS = env.WEB_ORIGINS.split(",");
