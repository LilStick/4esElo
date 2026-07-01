import {
  rawPlayerSchema,
  rawHistorySchema,
  rawMatchStatsSchema,
  normalizePlayer,
  normalizeHistory,
  normalizeMatchStats,
  type FaceitPlayer,
  type FaceitMatchRef,
  type FaceitMatchDetail,
} from "./schemas";

const DATA_API = "https://open.faceit.com/data/v4";

export class FaceitError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message?: string,
  ) {
    super(message ?? `Faceit API ${status} on ${path}`);
    this.name = "FaceitError";
  }
}

/** Thrown when a nickname/id resolves to no player (HTTP 404). */
export class FaceitNotFoundError extends FaceitError {}

export interface FaceitClientOptions {
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export class FaceitClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly apiKey: string,
    opts: FaceitClientOptions = {},
  ) {
    if (!apiKey) throw new Error("FaceitClient requires an API key");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const url = new URL(DATA_API + path);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    const res = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (res.status === 404) throw new FaceitNotFoundError(404, path);
    if (!res.ok) throw new FaceitError(res.status, path, await res.text().catch(() => undefined));
    return res.json();
  }

  /** Resolve a CS2 player by their Faceit nickname. */
  async getPlayerByNickname(nickname: string): Promise<FaceitPlayer> {
    const json = await this.get("/players", { nickname, game: "cs2" });
    return normalizePlayer(rawPlayerSchema.parse(json));
  }

  /** Fetch a player by their Faceit player_id. */
  async getPlayerById(playerId: string): Promise<FaceitPlayer> {
    const json = await this.get(`/players/${playerId}`);
    return normalizePlayer(rawPlayerSchema.parse(json));
  }

  /** Recent CS2 matches for a player (most recent first). */
  async getMatchHistory(
    playerId: string,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<FaceitMatchRef[]> {
    const json = await this.get(`/players/${playerId}/history`, {
      game: "cs2",
      limit,
      offset,
    });
    return normalizeHistory(rawHistorySchema.parse(json));
  }

  /** Detailed per-player stats for a match (all players, both teams). */
  async getMatchStats(matchId: string): Promise<FaceitMatchDetail | null> {
    const json = await this.get(`/matches/${matchId}/stats`);
    return normalizeMatchStats(matchId, rawMatchStatsSchema.parse(json));
  }
}
