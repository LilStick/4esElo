import { Hono } from "hono";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, players } from "@4eselo/db";
import type { ActivityDay, ActivityResponse } from "@4eselo/types";
import { readPlayerId, badRequest } from "./http";

export const activityRoutes = new Hono();

const activityDaysSchema = z.coerce.number().int().min(1).max(730).default(365);

/** Nb de matchs par jour UTC depuis la fenêtre. Pôle entier (playerId null) : un match
 *  joué par plusieurs membres compte une fois (distinct matchId). */
async function loadActivity(days: number, playerId: string | null): Promise<ActivityDay[]> {
  const cutoff = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  cutoff.setUTCHours(0, 0, 0, 0); // fenêtre alignée sur des jours UTC pleins, aujourd'hui inclus
  const rows = await db.execute<{ day: string; matches: number }>(sql`
    select to_char(played_at at time zone 'UTC', 'YYYY-MM-DD') as day,
           count(distinct match_id)::int as matches
    from faceit_match_stats
    where played_at >= ${cutoff.toISOString()}::timestamptz
      ${playerId ? sql`and player_id = ${playerId}` : sql``}
    group by 1
    order by 1
  `);
  return rows.map((r) => ({ day: r.day, matches: r.matches }));
}

activityRoutes.get("/activity", async (c) => {
  const parsed = activityDaysSchema.safeParse(c.req.query("days"));
  if (!parsed.success) return badRequest(c, "invalid days (1-730)");
  return c.json<ActivityResponse>({ days: parsed.data, activity: await loadActivity(parsed.data, null) });
});

activityRoutes.get("/players/:id/activity", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const parsed = activityDaysSchema.safeParse(c.req.query("days"));
  if (!parsed.success) return badRequest(c, "invalid days (1-730)");
  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);
  return c.json<ActivityResponse>({ days: parsed.data, activity: await loadActivity(parsed.data, id) });
});
