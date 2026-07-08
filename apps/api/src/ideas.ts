import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, ideas } from "@4eselo/db";
import type { IdeaItem, IdeasResponse, PostIdeaResponse } from "@4eselo/types";
import { DiscordWebhookClient, type DiscordWebhook } from "@4eselo/discord";
import { DISCORD_IDEAS_WEBHOOK_URL } from "./env";
import { readSession } from "./auth";
import { badRequest } from "./http";

/**
 * Boîte à idées (B17.7) : les membres connectés déposent des suggestions,
 * relayées dans un salon Discord via webhook. Webhook injectable (pattern
 * authDeps/registerDeps) → testable sans réseau ; absent = stockage seul.
 */
export const ideasDeps: { webhook: DiscordWebhook | null } = {
  webhook: DISCORD_IDEAS_WEBHOOK_URL ? new DiscordWebhookClient(DISCORD_IDEAS_WEBHOOK_URL) : null,
};

const MAX_PER_DAY = 3;
const RECENT_LIMIT = 50;
// trim + bornes = seule contrainte ; le texte est stocké brut (paramétré, pas de SQLi)
// et échappé au rendu côté front (pas de HTML serveur).
const bodySchema = z.object({ text: z.string().trim().min(1).max(500) });

export const ideasRoutes = new Hono();

ideasRoutes.post("/ideas", async (c) => {
  const session = await readSession(c);
  if (!session) return c.json({ error: "authentication required" }, 401);

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return badRequest(c, "invalid JSON body");
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return badRequest(c, "texte requis, 500 caractères max");

  // Rate-limit : 3 idées / membre / 24 h. Clé = discordId de la session signée.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ideas)
    .where(and(eq(ideas.discordId, session.discordId), gte(ideas.createdAt, since)));
  if ((recent?.count ?? 0) >= MAX_PER_DAY) {
    return c.json({ error: "limite de 3 idées par jour atteinte" }, 429);
  }

  const [created] = await db
    .insert(ideas)
    .values({ discordId: session.discordId, discordName: session.displayName, text: parsed.data.text })
    .returning();

  // Relais Discord best-effort : webhook absent/mort → l'idée est déjà stockée,
  // on logge et on répond 201 (jamais de 500 à cause du webhook).
  if (ideasDeps.webhook) {
    try {
      await ideasDeps.webhook.send({
        title: "💡 Nouvelle idée",
        description: parsed.data.text,
        footer: `par ${session.displayName}`,
      });
    } catch (err) {
      console.error("[ideas] webhook failed:", err instanceof Error ? err.message : err);
    }
  }

  const idea: IdeaItem = {
    id: created!.id,
    text: created!.text,
    author: created!.discordName,
    createdAt: created!.createdAt.toISOString(),
    mine: true,
  };
  return c.json<PostIdeaResponse>({ idea }, 201);
});

ideasRoutes.get("/ideas", async (c) => {
  const session = await readSession(c);
  if (!session) return c.json({ error: "authentication required" }, 401);

  const rows = await db.select().from(ideas).orderBy(desc(ideas.createdAt)).limit(RECENT_LIMIT);
  const items: IdeaItem[] = rows.map((r) => ({
    id: r.id,
    text: r.text,
    author: r.discordName,
    createdAt: r.createdAt.toISOString(),
    mine: r.discordId === session.discordId,
  }));
  return c.json<IdeasResponse>({ items });
});
