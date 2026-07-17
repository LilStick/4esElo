import type {
  AchievementsResponse,
  ActivityResponse,
  AdminPlayerPatch,
  Announcement,
  AnnouncementsResponse,
  BansResponse,
  BigWrappedResponse,
  DuosResponse,
  EloSource,
  IdeasResponse,
  StaffAnnouncementRequest,
  LeaderboardResponse,
  LineupsResponse,
  MapsLeaderboardResponse,
  MatchesResponse,
  MeResponse,
  MoversResponse,
  MoversWindow,
  OvertakesResponse,
  PlayerBenchmarkResponse,
  PlayerDetail,
  PlayerDuosResponse,
  PlayerBigWrappedResponse,
  PlayerStatsResponse,
  PlayerWrappedResponse,
  PostIdeaResponse,
  PresenceResponse,
  RecentMatchesResponse,
  RefreshEloResponse,
  RegisterLookupResponse,
  RegisterRequest,
  RegisterResponse,
  RoastResponse,
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

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await fail(res, path);
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) => send<T>("POST", path, body);

/**
 * Premier activé côté serveur ? On sonde `/premier/status` : 503 = désactivé
 * (flag `PREMIER_ENABLED` off), 200/401 = activé. Erreur réseau → considéré off.
 * Provisoire tant que `/me` n'expose pas `premierEnabled` (B18.13).
 */
export async function getPremierEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/premier/status`, { credentials: "include" });
    return res.status !== 503;
  } catch {
    return false;
  }
}

export function getLeaderboard(source: EloSource = "faceit", sparkline?: number) {
  const spark = sparkline ? `&sparkline=${sparkline}` : "";
  return get<LeaderboardResponse>(`/leaderboard?source=${source}${spark}`);
}

/** Classement du pôle par map (B13.5) - toutes les maps + leur top membres. */
export function getMapsLeaderboard() {
  return get<MapsLeaderboardResponse>(`/leaderboard/maps`);
}

export function getMovers(window: MoversWindow = "24h", source: EloSource = "faceit") {
  return get<MoversResponse>(`/leaderboard/movers?window=${window}&source=${source}`);
}

export function getOvertakes(window: MoversWindow = "7d", source: EloSource = "faceit") {
  return get<OvertakesResponse>(`/leaderboard/overtakes?window=${window}&source=${source}`);
}

export function getPresence() {
  return get<PresenceResponse>(`/presence`);
}

export function getAnnouncements(limit = 5) {
  return get<AnnouncementsResponse>(`/announcements?limit=${limit}`);
}

/** Boîte à idées (B17.8) - fil des idées récentes. */
export function getIdeas() {
  return get<IdeasResponse>(`/ideas`);
}

/** Poster une idée (session requise, 500 car. max, 3/jour). */
export function postIdea(text: string) {
  return post<PostIdeaResponse>(`/ideas`, { text });
}

export function getWrapped(year: number, month: number) {
  return get<WrappedResponse>(`/wrapped/${year}/${month}`);
}

export function getPlayerWrapped(year: number, month: number, playerId: string) {
  return get<PlayerWrappedResponse>(`/wrapped/${year}/${month}/${playerId}`);
}

/** BIG Wrapped du pôle (période longue : "2026" | "2026-H1" | "2026-H2"). */
export function getBigWrapped(period: string) {
  return get<BigWrappedResponse>(`/wrapped/big/${period}`);
}

export function getPlayerBigWrapped(period: string, playerId: string) {
  return get<PlayerBigWrappedResponse>(`/wrapped/big/${period}/${playerId}`);
}

export function getPlayer(id: string, source: EloSource = "faceit") {
  return get<PlayerDetail>(`/players/${id}?source=${source}`);
}

/** Rafraîchit l'ELO d'un joueur à la demande (B16.10) - resync Faceit, rate-limité 1/min. */
export function refreshPlayerElo(id: string) {
  return post<RefreshEloResponse>(`/players/${id}/refresh`);
}

/** Roast du joueur (B7.7) - punchlines profil (négatif + positif) + forecast ELO. */
export function getPlayerRoast(id: string) {
  return get<RoastResponse>(`/players/${id}/roast`);
}

/** Succès permanents du joueur (B7.9) - 14 paliers, débloqués + progression des verrouillés. */
export function getPlayerAchievements(id: string) {
  return get<AchievementsResponse>(`/players/${id}/achievements`);
}

export function getPlayerStats(id: string, range: StatsRange = "all") {
  return get<PlayerStatsResponse>(`/players/${id}/stats?range=${range}`);
}

/** Benchmark intra-asso (B5.12) - ta place dans le pôle (percentile par stat clé), même fenêtre que /stats. */
export function getPlayerBenchmark(id: string, range: StatsRange = "all") {
  return get<PlayerBenchmarkResponse>(`/players/${id}/benchmark?range=${range}`);
}

export function getPlayerMatches(id: string, limit = 10) {
  return get<MatchesResponse>(`/players/${id}/matches?limit=${limit}`);
}

/** Flux de matchs récents du pôle, tous joueurs confondus (B15.12). */
export function getRecentMatches(limit = 20) {
  return get<RecentMatchesResponse>(`/matches/recent?limit=${limit}`);
}

export function getActivity(days = 364) {
  return get<ActivityResponse>(`/activity?days=${days}`);
}

export function getPlayerActivity(id: string, days = 364) {
  return get<ActivityResponse>(`/players/${id}/activity?days=${days}`);
}

export function getDuos() {
  return get<DuosResponse>(`/social/duos`);
}

/** Lineups (B4.5) - groupes de 3 à 5 membres qui jouent ensemble (games + winrate). */
export function getLineups() {
  return get<LineupsResponse>(`/social/lineups`);
}

export function getPlayerDuos(id: string) {
  return get<PlayerDuosResponse>(`/players/${id}/duos`);
}

// --- Auth / compte (B17) ---

/** URL de login OAuth Discord - redirection pleine page (le back gère le flow + le cookie). */
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

// --- Admin (B17.5, tout derrière requireAdmin) ---

export function adminUpdatePlayer(id: string, patch: AdminPlayerPatch) {
  return send<{ ok: true }>("PATCH", `/admin/players/${id}`, patch);
}

/** Suppression = cascade sur tout l'historique → confirm=true obligatoire côté API. */
export function adminDeletePlayer(id: string) {
  return send<{ ok: true }>("DELETE", `/admin/players/${id}?confirm=true`);
}

export function adminPutAnnouncement(body: StaffAnnouncementRequest) {
  return send<Announcement>("PUT", `/admin/announcement`, body);
}

export function adminDeleteAnnouncement() {
  return send<{ ok: true }>("DELETE", `/admin/announcement`);
}

export function adminRegenerateWrapped(year: number, month: number) {
  return post<WrappedResponse>(`/admin/wrapped/${year}/${month}/regenerate`);
}

/** Bans (B17.10, admin) - liste, bannir un compte Discord (raison), débannir. */
export function getBans() {
  return get<BansResponse>(`/admin/bans`);
}

export function adminBan(discordId: string, reason: string | null) {
  return send<{ ok: true }>("PUT", `/admin/bans/${discordId}`, { reason });
}

export function adminUnban(discordId: string) {
  return send<{ ok: true }>("DELETE", `/admin/bans/${discordId}`);
}
