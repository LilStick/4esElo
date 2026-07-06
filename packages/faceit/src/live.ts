import { z } from "zod";
import { FaceitError } from "./client";

/**
 * UNOFFICIAL — the faceit.com frontend endpoint for a player's ongoing match,
 * behind Cloudflare bot management: a discrete call usually passes, repeated
 * traffic gets 403'd (measured 2026-07-06). Callers MUST treat failures as
 * "unknown" and degrade, never retry-storm. Kept behind the LiveMatchReader
 * interface so the source can be swapped without touching consumers.
 */

const LIVE_API = "https://api.faceit.com/match/v1/matches/groupByState";

const liveSchema = z.object({
  payload: z.record(z.string(), z.array(z.object({ id: z.string().optional() }).passthrough())),
});

export interface OngoingMatch {
  inMatch: boolean;
  matchId: string | null;
}

export interface LiveMatchReader {
  getOngoingMatch(faceitId: string): Promise<OngoingMatch>;
}

export class UnofficialLiveMatch implements LiveMatchReader {
  private readonly fetchImpl: typeof fetch;

  constructor(opts: { fetchImpl?: typeof fetch } = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async getOngoingMatch(faceitId: string): Promise<OngoingMatch> {
    const res = await this.fetchImpl(`${LIVE_API}?userId=${faceitId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Referer: "https://www.faceit.com/",
      },
    });
    if (!res.ok) throw new FaceitError(res.status, "/match/v1/matches/groupByState");
    const { payload } = liveSchema.parse(await res.json());
    for (const matches of Object.values(payload)) {
      if (matches.length > 0) return { inMatch: true, matchId: matches[0]!.id ?? null };
    }
    return { inMatch: false, matchId: null };
  }
}
