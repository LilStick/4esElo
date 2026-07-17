import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadEnv } from "@4eselo/env";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });

// fail-fast si mal configuré (B11.3)
const env = loadEnv(
  z.object({
    DATABASE_URL: z.string().url({ message: "URL Postgres attendue (voir .env.example)" }),
    API_PORT: z.coerce.number().int().positive().default(3001),
    STEAM_API_KEY: z.string().optional(),
    /** Register (lookup Faceit) ; absent = register 503. */
    FACEIT_API_KEY: z.string().optional(),
    WEB_ORIGINS: z.string().default("http://localhost:5173"),
    // Auth Discord (B17.1), optionnels : absents = auth off (/auth → 503, /me
    // anonyme). Tout-ou-rien vérifié plus bas. Préfixe OAUTH/ASSO : les DISCORD_*
    // non préfixés = bot dev (B9).
    DISCORD_OAUTH_CLIENT_ID: z.string().optional(),
    DISCORD_OAUTH_CLIENT_SECRET: z.string().optional(),
    DISCORD_OAUTH_REDIRECT_URI: z.string().url().optional(),
    DISCORD_ASSO_GUILD_ID: z.string().optional(),
    DISCORD_ASSO_INVITE_URL: z.string().url().optional(),
    /** Webhook salon idées ; absent = stockées sans relais (B17.7). */
    DISCORD_IDEAS_WEBHOOK_URL: z.string().url().optional(),
    /** Bot dev : poste les idées + vote ✅/❌ (B17.12) ; sinon fallback webhook. */
    DISCORD_BOT_TOKEN: z.string().optional(),
    /** Salon idées à voter ; requis avec BOT_TOKEN pour le relais bot (B17.12). */
    DISCORD_IDEAS_CHANNEL_ID: z.string().optional(),
    /** Salon notifs actions admin ; absent = no-op (B17.13). */
    DISCORD_ADMIN_CHANNEL_ID: z.string().optional(),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET : 32 caractères minimum").optional(),
    /** Whitelist admin : discord_id séparés par des virgules. */
    ADMIN_DISCORD_IDS: z.string().default(""),
    /** Feature flag V2 Premier (B18) : "true" = actif ; sinon routes/sync Premier inertes. */
    PREMIER_ENABLED: z.string().default("false"),
    /** Clé de chiffrement du game auth code Steam (64 hex) ; requise pour l'onboarding Premier. */
    STEAM_AUTH_ENC_KEY: z.string().length(64).optional(),
  }),
);

export const API_PORT = env.API_PORT;
export const STEAM_API_KEY = env.STEAM_API_KEY;
export const FACEIT_API_KEY = env.FACEIT_API_KEY;
export const DISCORD_IDEAS_WEBHOOK_URL = env.DISCORD_IDEAS_WEBHOOK_URL;
export const DISCORD_BOT_TOKEN = env.DISCORD_BOT_TOKEN;
export const DISCORD_IDEAS_CHANNEL_ID = env.DISCORD_IDEAS_CHANNEL_ID;
export const DISCORD_ADMIN_CHANNEL_ID = env.DISCORD_ADMIN_CHANNEL_ID;
/** Origines CORS, séparées par des virgules. */
export const WEB_ORIGINS = env.WEB_ORIGINS.split(",");
/** V2 Premier (B18) : dormant tant que non "true". */
export const PREMIER_ENABLED = env.PREMIER_ENABLED.toLowerCase() === "true";
export const STEAM_AUTH_ENC_KEY = env.STEAM_AUTH_ENC_KEY;

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  guildId: string;
  guildInviteUrl: string | null;
  sessionSecret: string;
  adminDiscordIds: string[];
}

const AUTH_KEYS = [
  "DISCORD_OAUTH_CLIENT_ID",
  "DISCORD_OAUTH_CLIENT_SECRET",
  "DISCORD_OAUTH_REDIRECT_URI",
  "DISCORD_ASSO_GUILD_ID",
  "SESSION_SECRET",
] as const;
const setKeys = AUTH_KEYS.filter((k) => env[k]);

// Config à moitié remplie = erreur de setup, pas un choix → fail-fast (B11.3).
if (setKeys.length > 0 && setKeys.length < AUTH_KEYS.length) {
  const missing = AUTH_KEYS.filter((k) => !env[k]).join(", ");
  throw new Error(`Auth Discord à moitié configurée - il manque : ${missing} (voir .env.example)`);
}

/** null = auth désactivée ; le site reste consultable. */
export const AUTH_CONFIG: AuthConfig | null =
  setKeys.length === AUTH_KEYS.length
    ? {
        clientId: env.DISCORD_OAUTH_CLIENT_ID!,
        clientSecret: env.DISCORD_OAUTH_CLIENT_SECRET!,
        redirectUri: env.DISCORD_OAUTH_REDIRECT_URI!,
        guildId: env.DISCORD_ASSO_GUILD_ID!,
        guildInviteUrl: env.DISCORD_ASSO_INVITE_URL ?? null,
        sessionSecret: env.SESSION_SECRET!,
        adminDiscordIds: env.ADMIN_DISCORD_IDS.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }
    : null;
