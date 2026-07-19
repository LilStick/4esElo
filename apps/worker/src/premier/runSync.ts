import {
  decryptSecret,
  type MatchWalker,
  type PremierMatchResolver,
  type PremierSyncStore,
  syncPlayerPremier,
} from "@4eselo/premier";
import { dbPremierStore, getConnectedMembers, type PremierConnectedMember } from "./store";

export interface PremierSyncRunDeps {
  walker: MatchWalker;
  resolver: PremierMatchResolver;
  encKey: string;
  /** Injectables (défauts = DB réelle). */
  store?: PremierSyncStore;
  getMembers?: () => Promise<PremierConnectedMember[]>;
}

/**
 * Un passage de sync Premier : pour chaque membre connecté, walk des nouveaux
 * matchs → résolution du rating → snapshots source=premier. Best-effort par membre.
 */
export async function runPremierSync(
  deps: PremierSyncRunDeps,
): Promise<{ members: number; snapshots: number }> {
  const store = deps.store ?? dbPremierStore;
  const members = await (deps.getMembers ?? getConnectedMembers)();
  if (members.length > 0) console.log(`[premier] sync: ${members.length} membre(s) connecté(s)`);
  let snapshots = 0;
  for (const m of members) {
    try {
      const authCode = decryptSecret(m.authCodeEnc, deps.encKey);
      const res = await syncPlayerPremier(
        { id: m.id, steamId64: m.steamId64, authCode, shareCode: m.shareCode, firstSync: !m.syncedAt },
        { walker: deps.walker, resolver: deps.resolver, store },
      );
      snapshots += res.snapshots;
      // Toujours logger (même à 0) pour la visibilité.
      console.log(
        `[premier] ${m.steamId64}: ${res.newMatches} match(s), +${res.snapshots} snapshot(s)${m.syncedAt ? "" : " (1er sync)"}`,
      );
    } catch (err) {
      console.error(`[premier] sync ${m.steamId64} échec:`, err instanceof Error ? err.message : err);
    }
  }
  return { members: members.length, snapshots };
}
