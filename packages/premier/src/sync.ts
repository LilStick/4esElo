import type { PremierMatchStats } from "@4eselo/types";
import type { MatchWalker } from "./walk";

/**
 * Orchestration pure du sync Premier d'un membre (B18.4) — zéro I/O ici.
 * Walk (nouveaux share codes) → pour chacun, résolution du rating via le
 * PremierMatchResolver (bot GC + démo, injecté) → snapshot-on-change → curseur avancé.
 * L'impl I/O du resolver (Game Coordinator + demoparser2) vit à part.
 */

export interface PremierMatchResult {
  /** CS Rating du membre après ce match (échelle 1000-35000), null en placement. */
  ratingAfter: number | null;
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

/**
 * Sync d'un membre : nb de nouveaux matchs vus, de snapshots posés, et l'erreur
 * qui a interrompu le passage le cas échéant (`abortError`). On REMONTE cette
 * erreur au lieu de l'avaler : un GC durablement HS gèle sinon tous les curseurs
 * en se faisant passer pour un « 1 match, +0 snapshot » anodin (bug vécu).
 */
export async function syncPlayerPremier(
  player: PremierPlayer,
  deps: PremierSyncDeps,
): Promise<{ newMatches: number; snapshots: number; abortError: Error | null }> {
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
  let abortError: Error | null = null;
  for (const code of codes) {
    let result;
    try {
      result = await deps.resolver.resolve(player.steamId64, code);
    } catch (err) {
      // Erreur (GC coupé, réseau) : on arrête proprement, on garde le progrès
      // acquis, on reprendra après `lastProcessed` au prochain cycle — et on
      // remonte l'erreur pour que le run la loggue fort (curseur figé = visible).
      abortError = err instanceof Error ? err : new Error(String(err));
      break;
    }
    lastProcessed = code;
    if (!result) continue; // irrésolvable (démo expirée) → sauté, mais curseur avance
    // Le match est toujours enregistré (y compris en placement) ; le point de courbe
    // n'est posé QUE si un rating est attribué (null = placement, pas encore classé).
    await deps.store.recordMatchStats(player.id, code, result);
    if (result.ratingAfter !== null) {
      await deps.store.recordRating(player.id, result.ratingAfter, result.playedAt);
      snapshots++;
    }
  }
  // On n'avance QUE jusqu'au dernier code traité (jamais au-delà) → aucun match sauté
  // par un arrêt anticipé. Si rien n'a été traité, on ne bouge pas (on réessaiera).
  if (lastProcessed) {
    await deps.store.advanceCursor(player.id, lastProcessed, deps.now?.() ?? new Date());
  }
  return { newMatches: codes.length, snapshots, abortError };
}
