import { Hono } from "hono";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db, announcements } from "@4eselo/db";
import type { Announcement, AnnouncementsResponse } from "@4eselo/types";
import { badRequest } from "./http";

export const announcementsRoutes = new Hono();

const announcementsLimitSchema = z.coerce.number().int().min(1).max(20).default(5);

announcementsRoutes.get("/announcements", async (c) => {
  const parsed = announcementsLimitSchema.safeParse(c.req.query("limit"));
  if (!parsed.success) return badRequest(c, "invalid limit (1-20)");

  const rows = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.publishedAt))
    .limit(parsed.data);

  const items: Announcement[] = rows.map((r) => ({
    id: r.id,
    type: r.type as Announcement["type"],
    title: r.title,
    body: r.body,
    linkUrl: r.linkUrl,
    publishedAt: r.publishedAt.toISOString(),
  }));
  return c.json<AnnouncementsResponse>({ announcements: items });
});
