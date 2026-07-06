import type {
  EloSource,
  LeaderboardResponse,
  MatchesResponse,
  MoversResponse,
  MoversWindow,
  PlayerDetail,
  PlayerStatsResponse,
  StatsRange,
} from "@4eselo/types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

export function getLeaderboard(source: EloSource = "faceit") {
  return get<LeaderboardResponse>(`/leaderboard?source=${source}`);
}

export function getMovers(window: MoversWindow = "24h", source: EloSource = "faceit") {
  return get<MoversResponse>(`/leaderboard/movers?window=${window}&source=${source}`);
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
