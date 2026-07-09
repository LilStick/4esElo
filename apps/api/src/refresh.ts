import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db, players, eloSnapshots } from "@4eselo/db";
import { FaceitClient, FaceitNotFoundError, type FaceitPlayer } from "@4eselo/faceit";
import type { RefreshEloResponse } from "@4eselo/types";
import { FACEIT_API_KEY } from "./env";
import { readPlayerId, badRequest } from "./http";

/**
 * Refresh ELO à la demande (B16.6). Sans worker 24/7, l'ELO du profil peut être
 * figé jusqu'au prochain sync ; ici on resync UN joueur depuis Faceit à la volée
 * (même règle snapshot-on-change que `syncPlayer` côté worker). Faceit injectable
 * (mockable en test) ; rate-limit mémoire pour ne pas marteler l'API Faceit.
 */

export interface RefreshFaceit {
  getPlayerById(faceitId: string): Promise<FaceitPlayer>;
}

export const refreshDeps: { faceit: RefreshFaceit | null } = {
  faceit: FACEIT_API_KEY ? new FaceitClient(FACEIT_API_KEY) : null,
};

const COOLDOWN_MS = 60_000;
const lastRefresh = new Map<string, number>();

/** Réinitialise le cooldown (tests). */
export function resetRefreshCooldown(): void {
  lastRefresh.clear();
}

export const refreshRoutes = new Hono();

refreshRoutes.post("/players/:id/refresh", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  if (!refreshDeps.faceit) return c.json({ error: "refresh not configured" }, 503);

  const [player] = await db
    .select({ faceitId: players.faceitId })
    .from(players)
    .where(eq(players.id, id))
    .limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);
  if (!player.faceitId) return c.json({ error: "player has no Faceit account" }, 409);

  // Rate-limit : on borne les tentatives (même échec) pour ne pas taper Faceit en boucle.
  const now = Date.now();
  const last = lastRefresh.get(id);
  if (last !== undefined && now - last < COOLDOWN_MS) {
    return c.json({ error: "déjà rafraîchi, réessaie dans une minute" }, 429);
  }
  lastRefresh.set(id, now);

  let profile: FaceitPlayer;
  try {
    profile = await refreshDeps.faceit.getPlayerById(player.faceitId);
  } catch (err) {
    if (err instanceof FaceitNotFoundError) return c.json({ error: "compte Faceit introuvable" }, 404);
    throw err; // 5xx/réseau → onError → 500 structuré, pas de crash
  }
  if (!profile.cs2) return c.json<RefreshEloResponse>({ elo: null, changed: false });

  const { elo, skillLevel } = profile.cs2;
  const [latest] = await db
    .select({ elo: eloSnapshots.elo })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, id), eq(eloSnapshots.source, "faceit")))
    .orderBy(desc(eloSnapshots.capturedAt))
    .limit(1);

  // Snapshot-on-change (jumelle de syncPlayer) : on n'insère un point que si l'ELO a bougé.
  const changed = (latest?.elo ?? null) !== elo;
  if (changed) {
    await db.insert(eloSnapshots).values({ playerId: id, source: "faceit", elo, level: skillLevel });
  }
  return c.json<RefreshEloResponse>({ elo, changed });
});
