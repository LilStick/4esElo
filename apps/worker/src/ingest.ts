import type { FaceitMatchStats } from "@4eselo/types";
import {
  FaceitError,
  FaceitNotFoundError,
  type FaceitMatchRef,
  type FaceitMatchDetail,
} from "@4eselo/faceit";

/**
 * Ingestion des matchs (B2.3) : pour un membre, on parcourt son historique borné
 * (récent d'abord), on saute le déjà-stocké, on récupère les stats par match.
 * Pure logic - réseau et DB en interfaces.
 */

export interface MatchReader {
  getMatchHistory(faceitId: string, opts: { limit: number; offset: number }): Promise<FaceitMatchRef[]>;
  getMatchStats(matchId: string): Promise<FaceitMatchDetail | null>;
}

export interface MatchStatsStore {
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
  windowDays?: number;
  /** Cap dur de matchs par run. */
  maxMatches?: number;
  /** Taille de page (Faceit : max 100). */
  pageSize?: number;
  /** Délai entre appels Faceit (rate limit). */
  throttleMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface IngestResult {
  /** Matchs vus dans la fenêtre. */
  scanned: number;
  inserted: number;
  /** Déjà stocké (dedup) ou bye/forfait - rien à fetch. */
  skipped: number;
  /** Fetch échoué ou membre absent du match - retenté au prochain run. */
  failed: number;
  /** Ids insérés par CE run (alimente l'heuristique eloAfter). */
  insertedMatchIds: string[];
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Un seul chemin pour les deux modes : le 1er run backfill toute la fenêtre, les
 * suivants s'arrêtent dès qu'une page entière est déjà stockée. Inserts oldest-first
 * → un run interrompu laisse un préfixe stocké contigu, l'early-stop reste correct.
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
  const result: IngestResult = {
    scanned: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    insertedMatchIds: [],
  };
  const toFetch: FaceitMatchRef[] = [];

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
      // Match de durée nulle = bye/forfait : jamais de page stats (404 permanent),
      // on ne tente même pas (#244).
      const fresh = inWindow.filter(
        (m) => !stored.has(m.matchId) && (m.finishedAt === null || m.finishedAt > m.startedAt),
      );
      result.skipped += inWindow.length - fresh.length;
      toFetch.push(...fresh);

      // Page entière déjà stockée → tout ce qui est plus vieux l'est aussi (préfixe
      // contigu) : l'incrémental s'arrête ici, en un appel.
      if (fresh.length === 0 && page.length === pageSize) break;
    }

    // Page courte ou bord de fenêtre → plus rien de plus vieux.
    if (page.length < pageSize || inWindow.length < page.length) break;
    offset += pageSize;
  }

  // Fetch + insert, oldest-first. Stats absentes en permanence (404, match annulé,
  // membre absent) → skip, le trou reflète la réalité. Échec transitoire (5xx/429/
  // réseau) → stop : le préfixe stocké reste contigu, le prochain run reprend ici.
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
        eloAfter: null, // backfill par le worker d'historique ELO (B2.4/B2.5)
        stats: me.stats,
      });
      result.inserted += 1;
      result.insertedMatchIds.push(ref.matchId);
    } catch (err) {
      if (err instanceof FaceitNotFoundError) {
        result.failed += 1;
        continue;
      }
      if (err instanceof FaceitError) {
        result.failed += 1;
        break;
      }
      throw err; // erreur DB/programmation : ne pas avaler
    }
  }

  return result;
}
