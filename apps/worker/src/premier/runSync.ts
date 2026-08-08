import {
  decryptSecret,
  ShareCodeExpiredError,
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
      if (res.abortError) {
        // Passage interrompu (typiquement GC HS) : curseur figé, les matchs vus
        // restent en attente. On le crie fort — sinon ça passe pour un banal
        // « N match, +0 snapshot » alors que plus rien ne remonte (bug vécu).
        console.error(
          `[premier] ${m.steamId64}: sync interrompu (${res.abortError.message}) - curseur figé, ${res.newMatches} match(s) en attente`,
        );
      } else {
        // Toujours logger (même à 0) pour la visibilité.
        console.log(
          `[premier] ${m.steamId64}: ${res.newMatches} match(s), +${res.snapshots} snapshot(s)${m.syncedAt ? "" : " (1er sync)"}`,
        );
      }
    } catch (err) {
      if (err instanceof ShareCodeExpiredError) {
        // Share code de départ > 30j (Steam 412) : le walk ne peut plus repartir.
        // Ce n'est PAS transitoire — le membre doit re-fournir un code récent
        // (re-onboarding). On le distingue de l'échec générique pour qu'il soit
        // actionnable. TODO(B18.x): poser un état lu par /premier/status côté front.
        console.warn(
          `[premier] ${m.steamId64}: share code de départ expiré (>30j) - re-onboarding requis (nouveau share code)`,
        );
        continue;
      }
      console.error(`[premier] sync ${m.steamId64} échec:`, err instanceof Error ? err.message : err);
    }
  }
  return { members: members.length, snapshots };
}
