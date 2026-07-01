export type EloSource = "faceit" | "premier";

export interface PlayerSummary {
  id: string;
  discordName: string | null;
  faceitNickname: string | null;
  steamId64: string | null;
  /** Current ELO for the requested source, null if unknown yet. */
  elo: number | null;
  /** Faceit skill level 1-10 (null for premier / unknown). */
  level: number | null;
}

export interface LeaderboardEntry extends PlayerSummary {
  rank: number;
}

export interface EloPoint {
  elo: number;
  capturedAt: string; // ISO
}

export interface PlayerDetail extends PlayerSummary {
  createdAt: string;
  history: EloPoint[];
}

export interface LeaderboardResponse {
  source: EloSource;
  leaderboard: LeaderboardEntry[];
}

export interface EloCurveResponse {
  source: EloSource;
  points: EloPoint[];
}
