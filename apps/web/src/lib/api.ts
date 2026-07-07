import type {
  EloSource,
  LeaderboardResponse,
  MatchesResponse,
  MeResponse,
  MoversResponse,
  MoversWindow,
  PlayerDetail,
  PlayerStatsResponse,
  PlayerWrappedResponse,
  PresenceResponse,
  RegisterLookupResponse,
  RegisterRequest,
  RegisterResponse,
  StatsRange,
  WrappedResponse,
} from "@4eselo/types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/** Erreur API portant le status HTTP + le message renvoyé par le back (pour les états d'UI). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fail(res: Response, path: string): Promise<never> {
  let message = `API ${res.status} on ${path}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) message = body.error;
  } catch {
    // pas de corps JSON exploitable → on garde le message générique
  }
  throw new ApiError(res.status, message);
}

// credentials: include → le cookie de session signé part avec chaque requête (CORS credentials côté API).
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) await fail(res, path);
  return (await res.json()) as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await fail(res, path);
  return (await res.json()) as T;
}

export function getLeaderboard(source: EloSource = "faceit", sparkline?: number) {
  const spark = sparkline ? `&sparkline=${sparkline}` : "";
  return get<LeaderboardResponse>(`/leaderboard?source=${source}${spark}`);
}

export function getMovers(window: MoversWindow = "24h", source: EloSource = "faceit") {
  return get<MoversResponse>(`/leaderboard/movers?window=${window}&source=${source}`);
}

export function getPresence() {
  return get<PresenceResponse>(`/presence`);
}

export function getWrapped(year: number, month: number) {
  return get<WrappedResponse>(`/wrapped/${year}/${month}`);
}

export function getPlayerWrapped(year: number, month: number, playerId: string) {
  return get<PlayerWrappedResponse>(`/wrapped/${year}/${month}/${playerId}`);
}

export function getPlayer(id: string, source: EloSource = "faceit") {
  return get<PlayerDetail>(`/players/${id}?source=${source}`);
}

export function getPlayerStats(id: string, range: StatsRange = "all") {
  return get<PlayerStatsResponse>(`/players/${id}/stats?range=${range}`);
}

export function getPlayerMatches(id: string, limit = 10) {
  return get<MatchesResponse>(`/players/${id}/matches?limit=${limit}`);
}

// --- Auth / compte (B17) ---

/** URL de login OAuth Discord — redirection pleine page (le back gère le flow + le cookie). */
export const loginUrl = () => `${BASE}/auth/login`;

/** Qui suis-je : session + fiche joueur matchée (ou anonyme). */
export function getMe() {
  return get<MeResponse>(`/me`);
}

export function logout() {
  return post<{ ok: true }>(`/auth/logout`);
}

/** Prévisualisation d'un pseudo Faceit avant inscription (avatar/ELO/niveau + déjà pris ?). */
export function registerLookup(nickname: string) {
  return get<RegisterLookupResponse>(`/register/lookup?nickname=${encodeURIComponent(nickname)}`);
}

/** Inscription : relie la session Discord au compte Faceit + promo EFREI. */
export function register(body: RegisterRequest) {
  return post<RegisterResponse>(`/register`, body);
}
