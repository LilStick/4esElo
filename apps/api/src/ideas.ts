import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, ideas } from "@4eselo/db";
import type { IdeaItem, IdeasResponse, PostIdeaResponse } from "@4eselo/types";
import {
  DiscordWebhookClient,
  DiscordBotClient,
  type DiscordWebhook,
  type DiscordBot,
} from "@4eselo/discord";
import { DISCORD_IDEAS_WEBHOOK_URL, DISCORD_BOT_TOKEN, DISCORD_IDEAS_CHANNEL_ID } from "./env";
import { readSession } from "./auth";
import { badRequest } from "./http";

/**
 * Boîte à idées (B17.7 / vote B17.12) : membres connectés → suggestions relayées
 * sur Discord. Relais injectables (cf. authDeps) : bot (poste + amorce ✅/❌,
 * votable), sinon webhook (poste sans réagir), sinon rien (idée stockée quand même).
 */
export const ideasDeps: {
  bot: DiscordBot | null;
  ideasChannelId: string | null;
  webhook: DiscordWebhook | null;
} = {
  bot: DISCORD_BOT_TOKEN ? new DiscordBotClient(DISCORD_BOT_TOKEN) : null,
  ideasChannelId: DISCORD_IDEAS_CHANNEL_ID ?? null,
  webhook: DISCORD_IDEAS_WEBHOOK_URL ? new DiscordWebhookClient(DISCORD_IDEAS_WEBHOOK_URL) : null,
};

/** Relais Discord : bot (+ vote) si dispo, sinon webhook, sinon rien. */
async function relayIdea(text: string, author: string): Promise<void> {
  const msg = { title: "💡 Nouvelle idée", description: text, footer: `par ${author}` };
  if (ideasDeps.bot && ideasDeps.ideasChannelId) {
    const messageId = await ideasDeps.bot.postMessage(ideasDeps.ideasChannelId, msg);
    // séquentiel pour garder l'ordre ✅ puis ❌
    await ideasDeps.bot.react(ideasDeps.ideasChannelId, messageId, "✅");
    await ideasDeps.bot.react(ideasDeps.ideasChannelId, messageId, "❌");
    return;
  }
  if (ideasDeps.webhook) await ideasDeps.webhook.send(msg);
}

const MAX_PER_DAY = 3;
const RECENT_LIMIT = 50;
// texte stocké brut (paramétré, pas de SQLi) ; échappé côté front.
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

  // Rate-limit : 3 idées / membre / 24h (clé = discordId session).
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

  // best-effort : idée déjà stockée → on logge, jamais de 500.
  try {
    await relayIdea(parsed.data.text, session.displayName);
  } catch (err) {
    console.error("[ideas] relais Discord failed:", err instanceof Error ? err.message : err);
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
