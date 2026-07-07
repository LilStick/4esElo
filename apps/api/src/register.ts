import { Hono } from "hono";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { db, players } from "@4eselo/db";
import { FaceitClient, FaceitNotFoundError, type FaceitPlayer } from "@4eselo/faceit";
import type { RegisterLookupResponse, RegisterResponse } from "@4eselo/types";
import { FACEIT_API_KEY } from "./env";
import { readSession } from "./auth";

/**
 * Register sur le site (B17.2) : OAuth prouve l'identité Discord (session B17.1),
 * le pseudo Faceit est validé en live, la promo EFREI est stockée.
 * Deux temps côté front : lookup (préviusalisation à confirmer) puis POST.
 */

/** Ce que le register consomme de Faceit — mockable en test. */
export interface FaceitLookup {
  getPlayerByNickname(nickname: string): Promise<FaceitPlayer>;
}

/** Swappable for tests (même pattern que authDeps/presenceDeps). */
export const registerDeps: { faceit: FaceitLookup | null } = {
  faceit: FACEIT_API_KEY ? new FaceitClient(FACEIT_API_KEY) : null,
};

const nicknameSchema = z.string().min(1).max(40);
const yearSchema = z.number().int().min(2000).max(2100);
const registerBodySchema = z
  .object({
    faceitNickname: nicknameSchema,
    formation: z.string().trim().min(1).max(60),
    promoStart: yearSchema,
    promoEnd: yearSchema,
  })
  .refine((b) => b.promoEnd >= b.promoStart, { message: "promoEnd < promoStart" });

/** Alumni 🎓 : fin de promo passée (2026-2028 devient alumni en 2029). */
export const isAlumni = (promoEnd: number, now: Date): boolean => promoEnd < now.getUTCFullYear();

export const registerRoutes = new Hono();

registerRoutes.get("/register/lookup", async (c) => {
  const session = await readSession(c);
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!registerDeps.faceit) return c.json({ error: "register not configured" }, 503);

  const parsed = nicknameSchema.safeParse(c.req.query("nickname"));
  if (!parsed.success) return c.json({ error: "invalid nickname" }, 400);

  let found: FaceitPlayer;
  try {
    found = await registerDeps.faceit.getPlayerByNickname(parsed.data);
  } catch (err) {
    if (err instanceof FaceitNotFoundError) {
      return c.json({ error: "pseudo Faceit introuvable — vérifie l'orthographe exacte" }, 404);
    }
    throw err; // Faceit down → onError → 500 structuré
  }

  const [claimed] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.faceitId, found.playerId))
    .limit(1);

  return c.json<RegisterLookupResponse>({
    faceitId: found.playerId,
    nickname: found.nickname,
    avatar: found.avatar,
    elo: found.cs2?.elo ?? null,
    level: found.cs2?.skillLevel ?? null,
    alreadyClaimed: claimed !== undefined,
  });
});

registerRoutes.post("/register", async (c) => {
  const session = await readSession(c);
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!registerDeps.faceit) return c.json({ error: "register not configured" }, 503);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = registerBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid body (faceitNickname, formation, promoStart ≤ promoEnd)" }, 400);
  }

  let found: FaceitPlayer;
  try {
    found = await registerDeps.faceit.getPlayerByNickname(parsed.data.faceitNickname);
  } catch (err) {
    if (err instanceof FaceitNotFoundError) {
      return c.json({ error: "pseudo Faceit introuvable — vérifie l'orthographe exacte" }, 404);
    }
    throw err;
  }

  // 1 Discord = 1 compte, 1 Faceit = 1 personne — vérifié avant insert pour des
  // messages clairs ; les contraintes uniques restent le filet anti-course.
  const [conflict] = await db
    .select({ discordId: players.discordId, faceitId: players.faceitId })
    .from(players)
    .where(or(eq(players.discordId, session.discordId), eq(players.faceitId, found.playerId)))
    .limit(1);
  if (conflict?.discordId === session.discordId) {
    return c.json({ error: "tu es déjà inscrit" }, 409);
  }
  if (conflict) {
    return c.json({ error: "ce compte Faceit est déjà relié à un membre" }, 409);
  }

  const [created] = await db
    .insert(players)
    .values({
      discordId: session.discordId,
      discordName: session.displayName,
      discordAvatar: session.avatar ?? null,
      faceitId: found.playerId,
      faceitNickname: found.nickname,
      steamId64: found.cs2?.steamId64 ?? null,
      formation: parsed.data.formation,
      promoStart: parsed.data.promoStart,
      promoEnd: parsed.data.promoEnd,
    })
    .onConflictDoNothing()
    .returning();
  if (!created) return c.json({ error: "ce compte Faceit est déjà relié à un membre" }, 409);

  return c.json<RegisterResponse>(
    {
      player: {
        id: created.id,
        discordName: created.discordName,
        faceitNickname: created.faceitNickname,
        steamId64: created.steamId64,
        elo: found.cs2?.elo ?? null,
        level: found.cs2?.skillLevel ?? null,
        discordAvatar: created.discordAvatar,
        formation: created.formation,
        promoStart: created.promoStart,
        promoEnd: created.promoEnd,
      },
      formation: created.formation!,
      promoStart: created.promoStart!,
      promoEnd: created.promoEnd!,
      isAlumni: isAlumni(created.promoEnd!, new Date()),
    },
    201,
  );
});
