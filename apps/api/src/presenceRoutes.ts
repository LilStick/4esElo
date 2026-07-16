import { Hono } from "hono";
import { db, players } from "@4eselo/db";
import { getPresence } from "./presence";

export const presenceRoutes = new Hono();

presenceRoutes.get("/presence", async (c) => {
  const rows = await db
    .select({
      id: players.id,
      faceitNickname: players.faceitNickname,
      discordName: players.discordName,
      discordId: players.discordId,
      discordAvatar: players.discordAvatar,
      steamId64: players.steamId64,
      faceitId: players.faceitId,
    })
    .from(players);
  return c.json(await getPresence(rows));
});
