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
  /** Retries on 429/5xx/network errors (B11.2). Default 3 attempts total. */
  maxAttempts?: number;
  /** First backoff delay; doubles each attempt, with jitter. */
  baseDelayMs?: number;
  /** Per-request timeout (AbortController). */
  timeoutMs?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** 429 (respecting Retry-After) and 5xx are transient; other 4xx are not. */
const isRetryableStatus = (status: number) => status === 429 || status >= 500;

export class FaceitClient {
  private readonly fetchImpl: typeof fetch;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly apiKey: string,
    opts: FaceitClientOptions = {},
  ) {
    if (!apiKey) throw new Error("FaceitClient requires an API key");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private async get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const url = new URL(DATA_API + path);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    let lastError: FaceitError | undefined;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        // Network error or timeout — transient by nature.
        lastError = new FaceitError(0, path, err instanceof Error ? err.message : String(err));
        await this.backoff(attempt);
        continue;
      }

      if (res.status === 404) throw new FaceitNotFoundError(404, path);
      if (res.ok) return res.json();
      if (!isRetryableStatus(res.status)) {
        throw new FaceitError(res.status, path, await res.text().catch(() => undefined));
      }

      lastError = new FaceitError(res.status, path);
      const retryAfter = Number(res.headers.get("Retry-After"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) await this.sleep(retryAfter * 1000);
      else await this.backoff(attempt);
    }
    throw lastError ?? new FaceitError(0, path, "retries exhausted");
  }

  /** Exponential backoff with jitter; no sleep after the final attempt. */
  private async backoff(attempt: number): Promise<void> {
    if (attempt >= this.maxAttempts) return;
    const base = this.baseDelayMs * 2 ** (attempt - 1);
    await this.sleep(base * (0.5 + Math.random() * 0.5));
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
