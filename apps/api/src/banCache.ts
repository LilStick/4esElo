import { db, bannedDiscordIds } from "@4eselo/db";

// Check de ban (B17.9) : sessions = cookies signés sans état, donc ban vérifié à chaque hit.
// Set des bannis en cache mémoire (TTL) invalidé à chaque ban/unban → effet quasi immédiat.

const TTL_MS = 30_000;
let cache: { ids: Set<string>; expires: number } | null = null;

export async function isBanned(discordId: string): Promise<boolean> {
  if (!cache || cache.expires < Date.now()) {
    const rows = await db.select({ discordId: bannedDiscordIds.discordId }).from(bannedDiscordIds);
    cache = { ids: new Set(rows.map((r) => r.discordId)), expires: Date.now() + TTL_MS };
  }
  return cache.ids.has(discordId);
}

/** Après un ban/unban : effet immédiat sans attendre le TTL. */
export function invalidateBanCache(): void {
  cache = null;
}
