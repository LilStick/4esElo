import type {
  EloSource,
  LeaderboardResponse,
  MatchesResponse,
  MoversResponse,
  MoversWindow,
  PlayerDetail,
  PlayerStatsResponse,
  PlayerWrappedResponse,
  PresenceResponse,
  StatsRange,
  WrappedResponse,
} from "@4eselo/types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
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
