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

  const enc = encryptSecret(parsed.data.steamAuthCode, premierDeps.encKey);
  const [updated] = await db
    .update(players)
    .set({ premierAuthCodeEnc: enc, premierShareCode: parsed.data.shareCode })
    .where(eq(players.discordId, session.discordId))
    .returning({ id: players.id });
  if (!updated) return c.json({ error: "membre inconnu (inscris-toi d'abord)" }, 404);
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
