import { z } from "zod";
import { FaceitError } from "./client";

/**
 * NON OFFICIEL - historique d'ELO par match (frontend faceit.com `/stats/v1/...`, #141).
 * Derrière Cloudflare : une requête isolée passe souvent, les bursts se prennent un 403.
 * Consommer de façon opportuniste (1 tentative polie, 403 = tant pis, jamais de retry-storm).
 * Isolé derrière EloHistoryProvider pour pouvoir changer de source sans toucher au backfill.
 */

const STATS_API = "https://api.faceit.com/stats/v1/stats/time/users";
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Referer: "https://www.faceit.com/",
};

/** Entries without an elo (unranked queues) are filtered out during normalization. */
const rawEntrySchema = z.object({
  matchId: z.string().optional(),
  date: z.number(), // epoch ms
  elo: z.string().optional(),
  elo_delta: z.string().optional(),
});
const rawHistorySchema = z.array(rawEntrySchema.passthrough());

export interface EloHistoryPoint {
  matchId: string | null;
  /** ELO right after that match. */
  elo: number;
  /** ± of that match; null when Faceit didn't provide it. */
  eloDelta: number | null;
  date: Date;
}

export interface EloHistoryProvider {
  /** Full per-match history, newest first. Throws FaceitError when blocked. */
  getEloHistory(faceitId: string, opts?: { limit?: number }): Promise<EloHistoryPoint[]>;
}

export interface UnofficialEloHistoryOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  pageSize?: number;
  throttleMs?: number;
}

export class UnofficialEloHistory implements EloHistoryProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pageSize: number;
  private readonly throttleMs: number;

  constructor(opts: UnofficialEloHistoryOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.pageSize = opts.pageSize ?? 200;
    this.throttleMs = opts.throttleMs ?? 700;
  }

  async getEloHistory(faceitId: string, opts: { limit?: number } = {}): Promise<EloHistoryPoint[]> {
    const limit = opts.limit ?? 1000;
    const out: EloHistoryPoint[] = [];
    for (let page = 0; out.length < limit; page++) {
      if (page > 0) await this.sleep(this.throttleMs);
      const url = `${STATS_API}/${faceitId}/games/cs2?page=${page}&size=${this.pageSize}`;
      const res = await this.fetchImpl(url, { headers: BROWSER_HEADERS });
      if (!res.ok) throw new FaceitError(res.status, "/stats/v1 (unofficial elo history)");
      const raw = rawHistorySchema.parse(await res.json());
      for (const e of raw) {
        const elo = Number(e.elo);
        if (!e.elo || !Number.isFinite(elo)) continue; // unranked entry
        const delta = Number(e.elo_delta);
        out.push({
          matchId: e.matchId ?? null,
          elo,
          eloDelta: e.elo_delta !== undefined && Number.isFinite(delta) ? delta : null,
          date: new Date(e.date),
        });
      }
      if (raw.length < this.pageSize) break; // last page
    }
    return out.slice(0, limit);
  }
}

/** Official Faceit skill-level ranges (level 10 = 2001+). */
export function eloToLevel(elo: number): number {
  const bounds = [800, 950, 1100, 1250, 1400, 1550, 1700, 1850, 2000];
  const idx = bounds.findIndex((b) => elo <= b);
  return idx === -1 ? 10 : idx + 1;
}
