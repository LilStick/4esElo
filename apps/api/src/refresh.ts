import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, players, eloSnapshots, faceitMatchStats } from "@4eselo/db";
import {
  FaceitClient,
  FaceitNotFoundError,
  ingestPlayerMatches,
  type FaceitPlayer,
  type MatchReader,
  type MatchStatsStore,
} from "@4eselo/faceit";
import { DiscordBotClient, type DiscordBot } from "@4eselo/discord";
import type { RefreshEloResponse } from "@4eselo/types";
import { FACEIT_API_KEY, DISCORD_BOT_TOKEN } from "./env";
import { readPlayerId, badRequest } from "./http";

// Refresh profil à la demande (B16.6 → B16.13) : un clic re-fetch TOUT ce qui concerne
// le membre — ELO (snapshot-on-change), avatar Discord, et matchs/stats récents
// (ingestion incrémentale partagée avec le worker). Rate-limit mémoire (anti-spam Faceit).

/** Faceit vu par le refresh : profil + lecture de matchs (pour la ré-ingestion). */
export interface RefreshFaceit extends MatchReader {
  getPlayerById(faceitId: string): Promise<FaceitPlayer>;
}

export const refreshDeps: {
  faceit: RefreshFaceit | null;
  bot: Pick<DiscordBot, "getUserAvatar"> | null;
} = {
  faceit: FACEIT_API_KEY ? new FaceitClient(FACEIT_API_KEY) : null,
  bot: DISCORD_BOT_TOKEN ? new DiscordBotClient(DISCORD_BOT_TOKEN) : null,
};

// Store d'ingestion côté API (mêmes 2 requêtes que le worker : chaque app câble son store).
const matchStore: MatchStatsStore = {
  async getStoredMatchIds(playerId, matchIds) {
    if (matchIds.length === 0) return new Set();
    const rows = await db
      .select({ matchId: faceitMatchStats.matchId })
      .from(faceitMatchStats)
      .where(and(eq(faceitMatchStats.playerId, playerId), inArray(faceitMatchStats.matchId, matchIds)));
    return new Set(rows.map((r) => r.matchId));
  },
  async insertMatchStats(row) {
    await db.insert(faceitMatchStats).values(row).onConflictDoNothing();
  },
};

const COOLDOWN_MS = 60_000;
const lastRefresh = new Map<string, number>();

export function resetRefreshCooldown(): void {
  lastRefresh.clear();
}

export const refreshRoutes = new Hono();

refreshRoutes.post("/players/:id/refresh", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  if (!refreshDeps.faceit) return c.json({ error: "refresh not configured" }, 503);
  const faceit = refreshDeps.faceit;

  const [player] = await db
    .select({
      faceitId: players.faceitId,
      discordId: players.discordId,
      discordAvatar: players.discordAvatar,
    })
    .from(players)
    .where(eq(players.id, id))
    .limit(1);
  if (!player) return c.json({ error: "player not found" }, 404);
  if (!player.faceitId) return c.json({ error: "player has no Faceit account" }, 409);
  const faceitId = player.faceitId;

  // Rate-limit : l'échec compte aussi, pour ne pas taper Faceit en boucle.
  const now = Date.now();
  const last = lastRefresh.get(id);
  if (last !== undefined && now - last < COOLDOWN_MS) {
    return c.json({ error: "déjà rafraîchi, réessaie dans une minute" }, 429);
  }
  lastRefresh.set(id, now);

  let profile: FaceitPlayer;
  try {
    profile = await faceit.getPlayerById(faceitId);
  } catch (err) {
    if (err instanceof FaceitNotFoundError) return c.json({ error: "compte Faceit introuvable" }, 404);
    throw err; // 5xx/réseau → onError → 500 structuré, pas de crash
  }

  // Avatar Discord (best-effort, indépendant de l'ELO) : suit la pdp courante même si
  // le membre l'a changée (l'ancien hash finit en 404). Snapshot-on-change.
  if (refreshDeps.bot && player.discordId) {
    try {
      const current = await refreshDeps.bot.getUserAvatar(player.discordId);
      if (current !== player.discordAvatar) {
        await db.update(players).set({ discordAvatar: current }).where(eq(players.id, id));
      }
    } catch {
      // best-effort : un souci Discord ne casse pas le refresh
    }
  }

  // Matchs/stats récents (best-effort) : ingestion incrémentale (ne refetch que le neuf).
  // Fenêtre courte = clic rapide ; l'historique profond reste le job du worker.
  try {
    await ingestPlayerMatches(faceit, matchStore, { id, faceitId }, { windowDays: 30, maxMatches: 30 });
  } catch (err) {
    console.error("[refresh] ingest failed:", err instanceof Error ? err.message : err);
  }

  // ELO : snapshot-on-change (comme le worker).
  if (!profile.cs2) return c.json<RefreshEloResponse>({ elo: null, changed: false, unranked: false });
  if (profile.cs2.unranked) return c.json<RefreshEloResponse>({ elo: null, changed: false, unranked: true });
  const { elo, skillLevel } = profile.cs2;
  if (elo === null) return c.json<RefreshEloResponse>({ elo: null, changed: false, unranked: true });

  const [latest] = await db
    .select({ elo: eloSnapshots.elo })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, id), eq(eloSnapshots.source, "faceit")))
    .orderBy(desc(eloSnapshots.capturedAt))
    .limit(1);

  const changed = (latest?.elo ?? null) !== elo;
  if (changed) {
    await db.insert(eloSnapshots).values({ playerId: id, source: "faceit", elo, level: skillLevel });
  }
  return c.json<RefreshEloResponse>({ elo, changed, unranked: false });
});
