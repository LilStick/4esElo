import { db, bannedDiscordIds } from "@4eselo/db";

/**
 * Check de ban (B17.9). Nos sessions sont des cookies signés sans état : pour
 * couper une session déjà ouverte, `readSession` vérifie le ban à chaque hit.
 * Pour ne pas requêter la DB à chaque requête, le set des bannis est mis en
 * cache mémoire court (TTL) et invalidé à chaque ban/unban → effet quasi
 * immédiat, et au pire rafraîchi après le TTL.
 */

const TTL_MS = 30_000;
let cache: { ids: Set<string>; expires: number } | null = null;

export async function isBanned(discordId: string): Promise<boolean> {
  if (!cache || cache.expires < Date.now()) {
    const rows = await db.select({ discordId: bannedDiscordIds.discordId }).from(bannedDiscordIds);
    cache = { ids: new Set(rows.map((r) => r.discordId)), expires: Date.now() + TTL_MS };
  }
  return cache.ids.has(discordId);
}

/** À appeler après un ban/unban pour que l'effet soit immédiat (pas d'attente du TTL). */
export function invalidateBanCache(): void {
  cache = null;
}
