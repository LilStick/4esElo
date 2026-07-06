import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load the monorepo-root .env regardless of the process cwd.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });

// Single access point for env vars — `process.env` is forbidden elsewhere (lint).
export const API_PORT = Number(process.env.API_PORT ?? 3001);
export const STEAM_API_KEY = process.env.STEAM_API_KEY;
/** Origines autorisées par le CORS, séparées par des virgules. */
export const WEB_ORIGINS = (process.env.WEB_ORIGINS ?? "http://localhost:5173").split(",");
