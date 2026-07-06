import { STEAM_API_KEY } from "./env";
import { SteamClient, type PresenceReader } from "@4eselo/steam";
import { UnofficialLiveMatch, type LiveMatchReader } from "@4eselo/faceit";
import type { PresenceEntry, PresenceResponse } from "@4eselo/types";

/**
 * Presence assembly (B15.5): Steam says who's in CS2, the unofficial Faceit
 * endpoint (fragile, best-effort) confirms "in a Faceit match" for those only.
 * The result is cached 60s in memory — presence is ephemeral, no table needed.
 */

export interface PresencePlayerRow {
  id: string;
  faceitNickname: string | null;
  discordName: string | null;
  steamId64: string | null;
  faceitId: string | null;
}

/** Swappable for integration tests. */
export const presenceDeps: {
  steam: PresenceReader;
  live: LiveMatchReader;
  sleep: (ms: number) => Promise<void>;
} = {
  steam: new SteamClient({ apiKey: STEAM_API_KEY }),
  live: new UnofficialLiveMatch(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

const CACHE_TTL_MS = 60_000;
let cache: { at: number; body: PresenceResponse } | null = null;

export function resetPresenceCache(): void {
  cache = null;
}

export async function getPresence(rows: PresencePlayerRow[]): Promise<PresenceResponse> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.body;

  const withSteam = rows.filter((r) => r.steamId64 !== null);
  let bySteamId = new Map<string, { online: boolean | null; inGameCs2: boolean }>();
  try {
    const presences = await presenceDeps.steam.getPresence(withSteam.map((r) => r.steamId64!));
    bySteamId = new Map(presences.map((p) => [p.steamId64, p]));
  } catch {
    // Steam down → every player reads as unknown; the widget shows a quiet empty state.
  }

  const players: PresenceEntry[] = [];
  for (const row of rows) {
    const steam = row.steamId64 ? bySteamId.get(row.steamId64) : undefined;
    const entry: PresenceEntry = {
      id: row.id,
      faceitNickname: row.faceitNickname,
      discordName: row.discordName,
      online: steam?.online ?? null,
      inGameCs2: steam?.inGameCs2 ?? false,
      inFaceitMatch: null,
    };
    if (entry.inGameCs2 && row.faceitId) {
      // Best-effort confirmation, one discrete call per in-game member.
      try {
        entry.inFaceitMatch = (await presenceDeps.live.getOngoingMatch(row.faceitId)).inMatch;
      } catch {
        entry.inFaceitMatch = null; // Cloudflare said no — Steam's answer stands
      }
      await presenceDeps.sleep(300);
    }
    players.push(entry);
  }

  const body: PresenceResponse = { updatedAt: new Date().toISOString(), players };
  cache = { at: Date.now(), body };
  return body;
}
