import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load the monorepo-root .env regardless of the process cwd.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });

// Single access point for env vars — `process.env` is forbidden elsewhere (lint).
export const FACEIT_API_KEY = process.env.FACEIT_API_KEY;
export const STEAM_API_KEY = process.env.STEAM_API_KEY;
export const WORKER_INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 10 * 60 * 1000);
