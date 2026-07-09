import { Hono } from "hono";
import { z } from "zod";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, players, faceitMatchStats } from "@4eselo/db";
import type { RecentMatchEntry, RecentMatchesResponse } from "@4eselo/types";
import { badRequest } from "./http";
import { effectiveEloDelta } from "./eloDelta";

/** ELO du match précédent (même joueur, chronologique) — pour dériver le ±ELO
 *  quand la colonne elo_delta n'est pas encore remplie (B2.12). Calculé sur tout
 *  l'historique du joueur (avant le LIMIT). */
const prevEloAfterExpr = sql<
  number | null
>`lag(${faceitMatchStats.eloAfter}) over (partition by ${faceitMatchStats.playerId} order by ${faceitMatchStats.playedAt} asc, ${faceitMatchStats.matchId} asc)`;

export const matchesRoutes = new Hono();

const recentLimitSchema = z.coerce.number().int().min(1).max(100).default(20);

/** Flux de matchs récents, tous joueurs confondus (B15.11) — alimente la home.
 *  Une ligne par membre par match (chacun son propre eloDelta). */
matchesRoutes.get("/matches/recent", async (c) => {
  const parsed = recentLimitSchema.safeParse(c.req.query("limit"));
  if (!parsed.success) return badRequest(c, "invalid limit (1-100)");
  const limit = parsed.data;

  const rows = await db
    .select({
      matchId: faceitMatchStats.matchId,
      map: faceitMatchStats.map,
      playedAt: faceitMatchStats.playedAt,
      result: faceitMatchStats.result,
      eloDelta: faceitMatchStats.eloDelta,
      eloAfter: faceitMatchStats.eloAfter,
      prevEloAfter: prevEloAfterExpr,
      pid: players.id,
      faceitNickname: players.faceitNickname,
      discordName: players.discordName,
      discordId: players.discordId,
      discordAvatar: players.discordAvatar,
    })
    .from(faceitMatchStats)
    .innerJoin(players, eq(faceitMatchStats.playerId, players.id))
    // matchId/playerId départagent les ex æquo → ordre stable (tests déterministes).
    .orderBy(desc(faceitMatchStats.playedAt), asc(faceitMatchStats.matchId), asc(players.id))
    .limit(limit);

  const items: RecentMatchEntry[] = rows.map((r) => ({
    matchId: r.matchId,
    player: {
      id: r.pid,
      nickname: r.faceitNickname ?? r.discordName ?? "?",
      discordId: r.discordId,
      discordAvatar: r.discordAvatar,
    },
    map: r.map,
    playedAt: r.playedAt.toISOString(),
    result: r.result,
    eloDelta: effectiveEloDelta(r.eloDelta, r.eloAfter, r.prevEloAfter),
  }));

  return c.json<RecentMatchesResponse>({ items });
});
