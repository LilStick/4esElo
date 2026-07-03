import type { SyncResult } from "./sync";
import type { IngestResult } from "./ingest";

/**
 * Forward eloAfter heuristic (B2.9) — the unofficial per-match ELO source is
 * gone, but a 10-minute tick knows enough: when the tick both recorded an ELO
 * change AND ingested exactly one new match, that match caused the change.
 * Any ambiguity (0 or several new matches, ELO unchanged) → no attribution:
 * a missing value beats a wrong one.
 */
export function attributeEloAfter(
  sync: SyncResult,
  ingest: IngestResult,
): { matchId: string; elo: number } | null {
  if (sync.status !== "recorded") return null;
  if (ingest.insertedMatchIds.length !== 1) return null;
  return { matchId: ingest.insertedMatchIds[0]!, elo: sync.elo };
}

export interface EloAfterStore {
  /** Fills elo_after on one stored match — only if still unset. */
  setEloAfter(playerId: string, matchId: string, elo: number): Promise<void>;
}
