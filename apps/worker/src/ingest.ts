import type { FaceitMatchStats } from "@4eselo/types";
import {
  FaceitError,
  FaceitNotFoundError,
  type FaceitMatchRef,
  type FaceitMatchDetail,
} from "@4eselo/faceit";

/**
 * Match ingestion (B2.3): for one member, walk their bounded match history
 * (newest first), skip what's already stored, fetch per-match stats and store
 * this member's row. Pure logic — network and DB come in as interfaces.
 */

export interface MatchReader {
  getMatchHistory(faceitId: string, opts: { limit: number; offset: number }): Promise<FaceitMatchRef[]>;
  getMatchStats(matchId: string): Promise<FaceitMatchDetail | null>;
}

export interface MatchStatsStore {
  /** Which of these match ids are already stored for this player. */
  getStoredMatchIds(playerId: string, matchIds: string[]): Promise<Set<string>>;
  insertMatchStats(row: {
    matchId: string;
    playerId: string;
    map: string;
    playedAt: Date;
    result: number;
    eloAfter: number | null;
    stats: FaceitMatchStats;
  }): Promise<void>;
}

export interface PlayerToIngest {
  /** Our DB id. */
  id: string;
  /** Faceit player_id. */
  faceitId: string;
}

export interface IngestOptions {
  /** How far back the backfill window reaches. */
  windowDays?: number;
  /** Hard cap on matches considered per run. */
  maxMatches?: number;
  /** History page size (Faceit accepts up to 100). */
  pageSize?: number;
  /** Delay between two Faceit calls — keeps us under the rate limit. */
  throttleMs?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface IngestResult {
  /** Matches seen inside the window. */
  scanned: number;
  inserted: number;
  /** Already stored (dedup). */
  skipped: number;
  /** Stats fetch failed or member missing from the match — retried next run. */
  failed: number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One code path covers both modes: the first run backfills the whole window,
 * later runs stop paging as soon as a full page is already stored. Inserts go
 * oldest-first so an interrupted run leaves a contiguous stored prefix and the
 * early-stop stays sound.
 */
export async function ingestPlayerMatches(
  reader: MatchReader,
  store: MatchStatsStore,
  player: PlayerToIngest,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const windowDays = opts.windowDays ?? 90;
  const maxMatches = opts.maxMatches ?? 100;
  const pageSize = opts.pageSize ?? 50;
  const throttleMs = opts.throttleMs ?? 400;
  const sleep = opts.sleep ?? realSleep;
  const now = opts.now ?? (() => new Date());

  const cutoff = new Date(now().getTime() - windowDays * 24 * 60 * 60 * 1000);
  const result: IngestResult = { scanned: 0, inserted: 0, skipped: 0, failed: 0 };
  const toFetch: FaceitMatchRef[] = [];

  // 1. Walk the history newest-first, page by page, inside the window.
  let offset = 0;
  while (result.scanned < maxMatches) {
    if (offset > 0) await sleep(throttleMs);
    const page = await reader.getMatchHistory(player.faceitId, { limit: pageSize, offset });
    const inWindow = page.filter((m) => m.startedAt >= cutoff).slice(0, maxMatches - result.scanned);
    result.scanned += inWindow.length;

    if (inWindow.length > 0) {
      const stored = await store.getStoredMatchIds(
        player.id,
        inWindow.map((m) => m.matchId),
      );
      const fresh = inWindow.filter((m) => !stored.has(m.matchId));
      result.skipped += inWindow.length - fresh.length;
      toFetch.push(...fresh);

      // Full page already stored → everything older is stored too (contiguous
      // prefix, see above). Typical incremental run stops here, on one call.
      if (fresh.length === 0 && page.length === pageSize) break;
    }

    // Short page or window edge reached → no older matches to look at.
    if (page.length < pageSize || inWindow.length < page.length) break;
    offset += pageSize;
  }

  // 2. Fetch stats and insert, oldest first.
  //    Stats permanently absent (404, cancelled match, member missing) → skip
  //    and move on: the gap reflects reality, it must not block newer matches.
  //    Transient failure (5xx/429/network) → stop here; the stored prefix stays
  //    contiguous so the early-stop above remains sound and the next run
  //    retries this match and everything newer.
  toFetch.reverse();
  for (const ref of toFetch) {
    await sleep(throttleMs);
    try {
      const detail = await reader.getMatchStats(ref.matchId);
      const me = detail?.players.find((p) => p.playerId === player.faceitId);
      if (!detail || !me) {
        result.failed += 1;
        continue;
      }
      await store.insertMatchStats({
        matchId: ref.matchId,
        playerId: player.id,
        map: detail.map,
        playedAt: ref.finishedAt ?? ref.startedAt,
        result: me.result,
        eloAfter: null, // backfilled by the ELO-history worker (B2.4/B2.5)
        stats: me.stats,
      });
      result.inserted += 1;
    } catch (err) {
      if (err instanceof FaceitNotFoundError) {
        result.failed += 1;
        continue;
      }
      if (err instanceof FaceitError) {
        result.failed += 1;
        break;
      }
      throw err; // DB/programming errors must not be silently absorbed
    }
  }

  return result;
}
