import type { PremierMatchStats } from "@4eselo/types";
import type { MatchWalker } from "./walk";

/**
 * Orchestration pure du sync Premier d'un membre (B18.4) — zéro I/O ici.
 * Walk (nouveaux share codes) → pour chacun, résolution du rating via le
 * PremierMatchResolver (bot GC + démo, injecté) → snapshot-on-change → curseur avancé.
 * L'impl I/O du resolver (Game Coordinator + demoparser2) vit à part.
 */

export interface PremierMatchResult {
  /** CS Rating du membre après ce match (échelle 0-35000). */
  ratingAfter: number;
  playedAt: Date;
  map: string;
  result: "win" | "loss" | "tie";
  myScore: number;
  oppScore: number;
  /** Stats du membre pour ce match (B18.14). */
  stats: PremierMatchStats;
}

export interface PremierMatchResolver {
  /** Résout un share code → résultat Premier du membre. null = irrésolvable (démo expirée, pas Premier, joueur absent). */
  resolve(steamId64: string, shareCode: string): Promise<PremierMatchResult | null>;
}

export interface PremierSyncStore {
  /** Point de courbe Premier ; l'impl n'insère que si le rating a changé (snapshot-on-change). */
  recordRating(playerId: string, rating: number, at: Date): Promise<void>;
  /** Ligne de stats du match (B18.14) ; upsert idempotent sur (shareCode, player). */
  recordMatchStats(playerId: string, shareCode: string, match: PremierMatchResult): Promise<void>;
  /** Avance le curseur (dernier share code traité) + horodate la sync. */
  advanceCursor(playerId: string, shareCode: string, syncedAt: Date): Promise<void>;
}

export interface PremierPlayer {
  id: string;
  steamId64: string;
  authCode: string;
  /** Dernier share code connu = curseur de départ du walk. */
  shareCode: string;
  /** Jamais synchronisé → on résout aussi le match d'onboarding (le seed lui-même). */
  firstSync: boolean;
}

export interface PremierSyncDeps {
  walker: MatchWalker;
  resolver: PremierMatchResolver;
  store: PremierSyncStore;
  now?: () => Date;
}

/** Sync d'un membre : renvoie le nb de nouveaux matchs vus et de snapshots posés. */
export async function syncPlayerPremier(
  player: PremierPlayer,
  deps: PremierSyncDeps,
): Promise<{ newMatches: number; snapshots: number }> {
  const walked = await deps.walker.walkFrom(player.steamId64, player.authCode, player.shareCode);
  // Walk = forward-only (matchs postérieurs au seed). Au 1er sync on résout AUSSI le
  // seed (le match d'onboarding), sinon il ne serait jamais compté.
  const codes = player.firstSync ? [player.shareCode, ...walked] : walked;
  let snapshots = 0;
  // Dernier code RÉELLEMENT traité (résolu ou irrésolvable, mais pas planté) : c'est
  // lui le nouveau curseur. On l'avance au fil de l'eau → si le sync s'arrête en cours
  // (ex. session GC coupée sur un match lourd), le progrès est sauvegardé et on ne
  // rejoue pas les matchs déjà traités au cycle suivant.
  let lastProcessed: string | null = null;
  for (const code of codes) {
    let result;
    try {
      result = await deps.resolver.resolve(player.steamId64, code);
    } catch {
      // Erreur transitoire (GC coupé, réseau) : on arrête proprement, on garde le
      // progrès acquis, et on reprendra après `lastProcessed` au prochain cycle.
      break;
    }
    lastProcessed = code;
    if (!result) continue; // irrésolvable (démo expirée) → sauté, mais curseur avance
    await deps.store.recordRating(player.id, result.ratingAfter, result.playedAt);
    await deps.store.recordMatchStats(player.id, code, result);
    snapshots++;
  }
  // On n'avance QUE jusqu'au dernier code traité (jamais au-delà) → aucun match sauté
  // par un arrêt anticipé. Si rien n'a été traité, on ne bouge pas (on réessaiera).
  if (lastProcessed) {
    await deps.store.advanceCursor(player.id, lastProcessed, deps.now?.() ?? new Date());
  }
  return { newMatches: codes.length, snapshots };
}
