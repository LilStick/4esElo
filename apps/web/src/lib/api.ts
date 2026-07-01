import type { EloSource, LeaderboardResponse, PlayerDetail } from "@4eselo/types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

export function getLeaderboard(source: EloSource = "faceit") {
  return get<LeaderboardResponse>(`/leaderboard?source=${source}`);
}

export function getPlayer(id: string, source: EloSource = "faceit") {
  return get<PlayerDetail>(`/players/${id}?source=${source}`);
}
