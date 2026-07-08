import { Hono } from "hono";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { announcements, bannedDiscordIds, db, players } from "@4eselo/db";
import type { Announcement, BanEntry, BansResponse, WrappedResponse } from "@4eselo/types";
import { requireAdmin, readSession, authDeps } from "./auth";
import { invalidateBanCache } from "./banCache";
import { computeAwards } from "./wrapped";
import { loadWrappedInputs } from "./wrappedData";

/**
 * Endpoints admin (B17.4) — tous derrière requireAdmin (session + whitelist).
 * L'annonce staff vit dans `announcements` (type "staff", dedupeKey fixe →
 * une seule active, PUT = upsert). La lecture publique = GET /announcements.
 */

const patchPlayerSchema = z
  .object({
    discordName: z.string().trim().min(1).max(60).nullable().optional(),
    formation: z.string().trim().min(1).max(60).nullable().optional(),
    promoStart: z.number().int().min(2000).max(2100).nullable().optional(),
    promoEnd: z.number().int().min(2000).max(2100).nullable().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: "empty patch" });

const staffAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(2000).nullable().optional(),
    linkUrl: z.string().trim().min(1).max(300).nullable().optional(),
  })
  .strict();

const uuidSchema = z.string().uuid();
const wrappedParamsSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

/** Une seule annonce staff active : l'unicité de dedupeKey fait l'upsert. */
const STAFF_DEDUPE_KEY = "staff";

export const adminRoutes = new Hono();
adminRoutes.use("/admin/*", requireAdmin);

adminRoutes.patch("/admin/players/:id", async (c) => {
  const id = uuidSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "invalid player id (uuid)" }, 400);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = patchPlayerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid patch (discordName, formation, promoStart, promoEnd)" }, 400);
  }

  const [updated] = await db
    .update(players)
    .set(parsed.data)
    .where(eq(players.id, id.data))
    .returning({ id: players.id });
  if (!updated) return c.json({ error: "player not found" }, 404);
  return c.json({ ok: true });
});

adminRoutes.delete("/admin/players/:id", async (c) => {
  const id = uuidSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "invalid player id (uuid)" }, 400);
  // Garde-fou : la suppression cascade sur tout l'historique (snapshots, matchs…).
  if (c.req.query("confirm") !== "true") {
    return c.json({ error: "destructive — add ?confirm=true" }, 400);
  }
  const [deleted] = await db.delete(players).where(eq(players.id, id.data)).returning({ id: players.id });
  if (!deleted) return c.json({ error: "player not found" }, 404);
  return c.json({ ok: true });
});

adminRoutes.put("/admin/announcement", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = staffAnnouncementSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid announcement (title, body?, linkUrl?)" }, 400);

  const values = {
    type: "staff",
    title: parsed.data.title,
    body: parsed.data.body ?? null,
    linkUrl: parsed.data.linkUrl ?? null,
    dedupeKey: STAFF_DEDUPE_KEY,
    publishedAt: new Date(),
  };
  const [row] = await db
    .insert(announcements)
    .values(values)
    .onConflictDoUpdate({ target: announcements.dedupeKey, set: values })
    .returning();

  return c.json<Announcement>({
    id: row!.id,
    type: "staff",
    title: row!.title,
    body: row!.body,
    linkUrl: row!.linkUrl,
    publishedAt: row!.publishedAt.toISOString(),
  });
});

adminRoutes.delete("/admin/announcement", async (c) => {
  await db.delete(announcements).where(eq(announcements.dedupeKey, STAFF_DEDUPE_KEY));
  return c.json({ ok: true });
});

adminRoutes.post("/admin/wrapped/:year/:month/regenerate", async (c) => {
  const parsed = wrappedParamsSchema.safeParse({
    year: c.req.param("year"),
    month: c.req.param("month"),
  });
  if (!parsed.success) return c.json({ error: "invalid year/month" }, 400);
  const { year, month } = parsed.data;

  const inputs = await loadWrappedInputs(year, month);
  const awards = computeAwards(inputs);
  if (awards.length === 0) return c.json({ error: "mois sans données — rien à annoncer" }, 409);

  // Re-publie l'annonce du mois (recréée si supprimée, re-datée sinon).
  const MONTHS = "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split(
    " ",
  );
  const values = {
    type: "wrapped",
    title: `Le Wrapped de ${MONTHS[month - 1]} est là 🎁`,
    body: null,
    linkUrl: `/wrapped/${MONTHS[month - 1]}-${year}`,
    dedupeKey: `wrapped-${year}-${String(month).padStart(2, "0")}`,
    publishedAt: new Date(),
  };
  await db
    .insert(announcements)
    .values(values)
    .onConflictDoUpdate({ target: announcements.dedupeKey, set: values });

  return c.json<WrappedResponse>({ year, month, awards });
});

// --- Bans (B17.9) : couper l'accès au site à un compte Discord. ---
const discordIdSchema = z.string().regex(/^\d{5,32}$/, "snowflake Discord attendu");
const banBodySchema = z.object({ reason: z.string().trim().max(300).optional() }).strict();

adminRoutes.get("/admin/bans", async (c) => {
  const rows = await db.select().from(bannedDiscordIds).orderBy(desc(bannedDiscordIds.createdAt));
  const bans: BanEntry[] = rows.map((r) => ({
    discordId: r.discordId,
    reason: r.reason,
    bannedBy: r.bannedBy,
    createdAt: r.createdAt.toISOString(),
  }));
  return c.json<BansResponse>({ bans });
});

adminRoutes.put("/admin/bans/:discordId", async (c) => {
  const id = discordIdSchema.safeParse(c.req.param("discordId"));
  if (!id.success) return c.json({ error: "invalid discord id" }, 400);
  // Filet anti-lockout : on ne bannit pas un admin whitelisté.
  if (authDeps.config?.adminDiscordIds.includes(id.data)) {
    return c.json({ error: "impossible de bannir un admin" }, 400);
  }
  let body: unknown = {};
  try {
    body = await c.req.json();
  } catch {
    // corps optionnel (ban sans raison) → {} par défaut
  }
  const parsed = banBodySchema.safeParse(body ?? {});
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);

  const session = await readSession(c); // requireAdmin garantit une session admin
  const reason = parsed.data.reason ?? null;
  const bannedBy = session?.discordId ?? null;
  await db
    .insert(bannedDiscordIds)
    .values({ discordId: id.data, reason, bannedBy })
    .onConflictDoUpdate({ target: bannedDiscordIds.discordId, set: { reason, bannedBy } });
  invalidateBanCache(); // effet immédiat : coupe aussi les sessions déjà ouvertes
  return c.json({ ok: true });
});

adminRoutes.delete("/admin/bans/:discordId", async (c) => {
  const id = discordIdSchema.safeParse(c.req.param("discordId"));
  if (!id.success) return c.json({ error: "invalid discord id" }, 400);
  await db.delete(bannedDiscordIds).where(eq(bannedDiscordIds.discordId, id.data));
  invalidateBanCache();
  return c.json({ ok: true });
});
