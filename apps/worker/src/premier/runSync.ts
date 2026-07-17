import { createMatchWalker, syncPlayerPremier, decryptSecret } from "@4eselo/premier";
import { createResolver } from "./resolver";
import { dbPremierStore, getConnectedMembers } from "./store";
import type { GcBot } from "./gcBot";

/**
 * Un passage de sync Premier : pour chaque membre connecté, walk des nouveaux
 * matchs → résolution du rating via le bot GC → snapshots source=premier.
 * Best-effort par membre : un échec n'arrête pas les autres.
 */
export async function runPremierSync(deps: { bot: GcBot; apiKey: string; encKey: string }): Promise<void> {
  const members = await getConnectedMembers();
  if (members.length === 0) return;
  const walker = createMatchWalker(deps.apiKey);
  const resolver = createResolver(deps.bot);

  for (const m of members) {
    try {
      const authCode = decryptSecret(m.authCodeEnc, deps.encKey);
      const res = await syncPlayerPremier(
        { id: m.id, steamId64: m.steamId64, authCode, shareCode: m.shareCode },
        { walker, resolver, store: dbPremierStore },
      );
      if (res.snapshots > 0) {
        console.log(`[premier] ${m.steamId64}: +${res.snapshots} snapshots (${res.newMatches} matchs vus)`);
      }
    } catch (err) {
      console.error(`[premier] sync ${m.steamId64} échec:`, err instanceof Error ? err.message : err);
    }
  }
}
