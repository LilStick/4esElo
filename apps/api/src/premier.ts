import { Hono, type Context } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, players } from "@4eselo/db";
import { encryptSecret } from "@4eselo/premier";
import type { PremierConnectionStatus } from "@4eselo/types";
import { readSession } from "./auth";
import { PREMIER_ENABLED, STEAM_AUTH_ENC_KEY } from "./env";

/**
 * Onboarding Premier (B18.2) : un membre connecte son compte Steam en fournissant
 * son game auth code (chiffré au repos) + un share code récent (curseur du walk).
 * Tout est gated par PREMIER_ENABLED : dormant en prod tant que le flag est off.
 */

/** Injectable pour les tests (cf. authDeps). */
export const premierDeps = { enabled: PREMIER_ENABLED, encKey: STEAM_AUTH_ENC_KEY as string | undefined };

const connectSchema = z
  .object({
    steamAuthCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{5,40}$/, "auth code invalide"),
    shareCode: z
      .string()
      .trim()
      .regex(/^CSGO(-[A-Za-z0-9]{5}){5}$/, "share code invalide (CSGO-xxxxx-…)"),
  })
  .strict();

const disabled = (c: Context) => c.json({ error: "premier disabled" }, 503);
const needsAuth = (c: Context) => c.json({ error: "authentication required" }, 401);

// Cooldown du refresh : un clic replanifie une ré-résolution côté worker. On évite
// qu'un membre relance le walk en boucle (l'endpoint Steam est sensible au burst → 429).
const REFRESH_COOLDOWN_MS = 30_000;
const lastRefresh = new Map<string, number>();
export function resetPremierRefreshCooldown(): void {
  lastRefresh.clear();
}

export const premierRoutes = new Hono();

premierRoutes.get("/premier/status", async (c) => {
  if (!premierDeps.enabled) return disabled(c);
  const session = await readSession(c);
  if (!session) return needsAuth(c);
  const [p] = await db
    .select({ enc: players.premierAuthCodeEnc, syncedAt: players.premierSyncedAt })
    .from(players)
    .where(eq(players.discordId, session.discordId))
    .limit(1);
  return c.json<PremierConnectionStatus>({
    connected: !!p?.enc,
    syncedAt: p?.syncedAt ? p.syncedAt.toISOString() : null,
  });
});

premierRoutes.post("/premier/connect", async (c) => {
  if (!premierDeps.enabled) return disabled(c);
  if (!premierDeps.encKey) return c.json({ error: "premier not configured (missing enc key)" }, 503);
  const session = await readSession(c);
  if (!session) return needsAuth(c);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid (steamAuthCode, shareCode)" }, 400);

  const [member] = await db
    .select({ id: players.id, steamId64: players.steamId64 })
    .from(players)
    .where(eq(players.discordId, session.discordId))
    .limit(1);
  if (!member) return c.json({ error: "membre inconnu (inscris-toi d'abord)" }, 404);
  // Le walk Premier a besoin du steamId64 ; sans lui le sync filtre le membre en
  // silence → il resterait « connecté » sans jamais de rating. On refuse tôt.
  if (!member.steamId64)
    return c.json({ error: "compte Steam non lié — impossible de synchroniser Premier" }, 409);

  const enc = encryptSecret(parsed.data.steamAuthCode, premierDeps.encKey);
  // Reset de syncedAt → firstSync au prochain passage : le match d'onboarding
  // (le share code fourni) est ré-résolu. Sinon une reconnexion avec un code frais
  // n'apparaîtrait jamais (le seed ne serait pas traité).
  await db
    .update(players)
    .set({ premierAuthCodeEnc: enc, premierShareCode: parsed.data.shareCode, premierSyncedAt: null })
    .where(eq(players.id, member.id));
  return c.json({ ok: true });
});

premierRoutes.post("/premier/refresh", async (c) => {
  if (!premierDeps.enabled) return disabled(c);
  const session = await readSession(c);
  if (!session) return needsAuth(c);
  const [p] = await db
    .select({ id: players.id, enc: players.premierAuthCodeEnc })
    .from(players)
    .where(eq(players.discordId, session.discordId))
    .limit(1);
  if (!p) return c.json({ error: "membre inconnu (inscris-toi d'abord)" }, 404);
  if (!p.enc) return c.json({ error: "compte Premier non connecté" }, 409);

  const now = Date.now();
  const last = lastRefresh.get(session.discordId);
  if (last !== undefined && now - last < REFRESH_COOLDOWN_MS) {
    return c.json({ error: "déjà demandé, réessaie dans un instant" }, 429);
  }
  lastRefresh.set(session.discordId, now);

  // Re-check sans délink/relink : syncedAt → null force firstSync au prochain passage
  // worker (le curseur est ré-résolu). Auth code + share code restent intacts.
  await db.update(players).set({ premierSyncedAt: null }).where(eq(players.id, p.id));
  return c.json({ ok: true });
});

premierRoutes.delete("/premier/connect", async (c) => {
  if (!premierDeps.enabled) return disabled(c);
  const session = await readSession(c);
  if (!session) return needsAuth(c);
  await db
    .update(players)
    .set({ premierAuthCodeEnc: null, premierShareCode: null, premierSyncedAt: null })
    .where(eq(players.discordId, session.discordId));
  return c.json({ ok: true });
});
