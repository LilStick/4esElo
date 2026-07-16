import { FaceitError, FaceitNotFoundError, type FaceitMatchDetail } from "@4eselo/faceit";
import type { MatchTeam } from "@4eselo/types";

/**
 * Vue match-level (B4.3) : remplit `matches` depuis les matchs connus
 * (faceit_match_stats) pas encore présents - couvre nouveaux et anciens d'un geste.
 * Pure logic : reader + store en paramètre.
 */

export interface MatchToBackfill {
  matchId: string;
  playedAt: Date;
}

export interface MatchDetailReader {
  getMatchStats(matchId: string): Promise<FaceitMatchDetail | null>;
}

export interface MatchLevelStore {
  /** matchIds présents dans faceit_match_stats mais absents de `matches` (+ leur date). */
  getMatchesToBackfill(limit: number): Promise<MatchToBackfill[]>;
  insertMatch(row: {
    matchId: string;
    map: string;
    playedAt: Date;
    winnerTeamId: string | null;
    teams: MatchTeam[];
  }): Promise<void>;
}

export interface IngestMatchesOptions {
  /** Cap de matchs par run (le reste au run suivant). */
  maxMatches?: number;
  throttleMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface IngestMatchesResult {
  scanned: number;
  inserted: number;
  /** Détail absent (404, match annulé) → sauté, ne bloque pas les autres. */
  failed: number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function ingestMatches(
  reader: MatchDetailReader,
  store: MatchLevelStore,
  opts: IngestMatchesOptions = {},
): Promise<IngestMatchesResult> {
  const maxMatches = opts.maxMatches ?? 100;
  const throttleMs = opts.throttleMs ?? 400;
  const sleep = opts.sleep ?? realSleep;

  const todo = await store.getMatchesToBackfill(maxMatches);
  const result: IngestMatchesResult = { scanned: todo.length, inserted: 0, failed: 0 };

  for (let i = 0; i < todo.length; i++) {
    const { matchId, playedAt } = todo[i]!;
    if (i > 0) await sleep(throttleMs);
    try {
      const detail = await reader.getMatchStats(matchId);
      if (!detail) {
        result.failed += 1; // stats définitivement absentes (annulé…) → on saute
        continue;
      }
      await store.insertMatch({
        matchId,
        map: detail.map,
        playedAt,
        winnerTeamId: detail.winnerTeamId,
        teams: detail.teams,
      });
      result.inserted += 1;
    } catch (err) {
      if (err instanceof FaceitNotFoundError) {
        result.failed += 1;
        continue;
      }
      if (err instanceof FaceitError) {
        result.failed += 1;
        break; // transitoire (5xx/429/réseau) → on s'arrête, on retentera au prochain run
      }
      throw err; // erreur DB/programmation : ne pas avaler
    }
  }
  return result;
}
