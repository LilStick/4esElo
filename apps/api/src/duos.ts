import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, players, faceitMatchStats } from "@4eselo/db";
import type { DuoPlayer, DuosResponse, LineupsResponse, PlayerDuosResponse } from "@4eselo/types";
import {
  computeDuos,
  computeLineups,
  computePlayerDuos,
  MIN_DUO_MATCHES,
  MIN_LINEUP_MATCHES,
} from "./social";
import { readPlayerId, badRequest } from "./http";

export const duosRoutes = new Hono();

/** Membres (id + pseudo affichable) + lignes de matchs - l'entrée du calcul de duos. */
async function loadSocialInputs() {
  const playerRows = await db
    .select({
      id: players.id,
      faceitNickname: players.faceitNickname,
      discordName: players.discordName,
      discordId: players.discordId,
      discordAvatar: players.discordAvatar,
    })
    .from(players);
  const members: DuoPlayer[] = playerRows.map((p) => ({
    id: p.id,
    nickname: p.faceitNickname ?? p.discordName ?? p.id,
    discordId: p.discordId,
    discordAvatar: p.discordAvatar,
  }));
  const matchRows = await db
    .select({
      matchId: faceitMatchStats.matchId,
      playerId: faceitMatchStats.playerId,
      result: faceitMatchStats.result,
    })
    .from(faceitMatchStats);
  return { members, matchRows };
}

duosRoutes.get("/social/duos", async (c) => {
  const { members, matchRows } = await loadSocialInputs();
  return c.json<DuosResponse>({
    minMatches: MIN_DUO_MATCHES,
    duos: computeDuos(members, matchRows),
  });
});

duosRoutes.get("/social/lineups", async (c) => {
  const { members, matchRows } = await loadSocialInputs();
  return c.json<LineupsResponse>({
    minMatches: MIN_LINEUP_MATCHES,
    lineups: computeLineups(members, matchRows),
  });
});

duosRoutes.get("/players/:id/duos", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const [player] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);

  const { members, matchRows } = await loadSocialInputs();
  return c.json<PlayerDuosResponse>({
    playerId: id,
    minMatches: MIN_DUO_MATCHES,
    duos: computePlayerDuos(id, members, matchRows),
  });
});
