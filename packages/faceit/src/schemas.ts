import { z } from "zod";
import type { FaceitMatchStats } from "@4eselo/types";

/**
 * Raw shapes from the Faceit Data API v4 (https://open.faceit.com/data/v4).
 * We only validate the fields we actually consume; unknown fields are ignored.
 */

const cs2GameSchema = z.object({
  region: z.string().optional(),
  game_player_id: z.string().optional(), // Steam ID64
  game_player_name: z.string().optional(),
  skill_level: z.number(),
  faceit_elo: z.number(),
});

export const rawPlayerSchema = z.object({
  player_id: z.string(),
  nickname: z.string(),
  avatar: z.string().optional().default(""),
  country: z.string().optional().default(""),
  games: z
    .object({
      cs2: cs2GameSchema.optional(),
    })
    .default({}),
});

const historyItemSchema = z.object({
  match_id: z.string(),
  game_id: z.string().optional(),
  region: z.string().optional(),
  started_at: z.number(),
  finished_at: z.number().optional(),
});

export const rawHistorySchema = z.object({
  items: z.array(historyItemSchema),
  start: z.number().optional(),
  end: z.number().optional(),
});

/** Normalized shapes we expose to the rest of the app. */

export interface FaceitCs2Profile {
  elo: number;
  skillLevel: number;
  steamId64: string | null;
}

export interface FaceitPlayer {
  playerId: string;
  nickname: string;
  avatar: string | null;
  country: string | null;
  /** null when the player has never played CS2 on Faceit. */
  cs2: FaceitCs2Profile | null;
}

export interface FaceitMatchRef {
  matchId: string;
  startedAt: Date;
  finishedAt: Date | null;
}

export function normalizePlayer(raw: z.infer<typeof rawPlayerSchema>): FaceitPlayer {
  const cs2 = raw.games.cs2;
  return {
    playerId: raw.player_id,
    nickname: raw.nickname,
    avatar: raw.avatar || null,
    country: raw.country || null,
    cs2: cs2
      ? {
          elo: cs2.faceit_elo,
          skillLevel: cs2.skill_level,
          steamId64: cs2.game_player_id ?? null,
        }
      : null,
  };
}

export function normalizeHistory(raw: z.infer<typeof rawHistorySchema>): FaceitMatchRef[] {
  return raw.items.map((it) => ({
    matchId: it.match_id,
    startedAt: new Date(it.started_at * 1000),
    finishedAt: it.finished_at ? new Date(it.finished_at * 1000) : null,
  }));
}

/** Match stats: values come as strings; player_stats keys vary, so we keep them loose. */
export const rawMatchStatsSchema = z.object({
  rounds: z.array(
    z.object({
      round_stats: z.record(z.string(), z.string()),
      teams: z.array(
        z.object({
          team_id: z.string().optional(),
          team_stats: z.record(z.string(), z.string()).optional(),
          players: z.array(
            z.object({
              player_id: z.string(),
              nickname: z.string(),
              player_stats: z.record(z.string(), z.string()),
            }),
          ),
        }),
      ),
    }),
  ),
});

export interface FaceitMatchPlayer {
  playerId: string;
  nickname: string;
  result: number; // 1 win, 0 loss
  stats: FaceitMatchStats;
}

/** Une équipe d'un match (faction) - pour la vue match-level (B4.3, lineups). */
export interface FaceitMatchTeam {
  /** faction id Faceit (faction1/faction2), sinon fallback stable. */
  teamId: string;
  /** Score final de l'équipe (manches gagnées), 0 si indisponible. */
  score: number;
  /** Faceit player_id des joueurs de cette équipe. */
  playerIds: string[];
}

export interface FaceitMatchDetail {
  matchId: string;
  map: string;
  players: FaceitMatchPlayer[];
  /** Composition + score par équipe (B4.3). */
  teams: FaceitMatchTeam[];
  /** team_id gagnant (round_stats "Winner"), null si indéterminé. */
  winnerTeamId: string | null;
}

const num = (r: Record<string, string>, key: string): number => {
  const n = Number(r[key]);
  return Number.isFinite(n) ? n : 0;
};

function toStats(s: Record<string, string>): FaceitMatchStats {
  return {
    kills: num(s, "Kills"),
    deaths: num(s, "Deaths"),
    assists: num(s, "Assists"),
    kd: num(s, "K/D Ratio"),
    kr: num(s, "K/R Ratio"),
    adr: num(s, "ADR"),
    damage: num(s, "Damage"),
    hsPercent: num(s, "Headshots %"),
    mvps: num(s, "MVPs"),
    doubleKills: num(s, "Double Kills"),
    tripleKills: num(s, "Triple Kills"),
    quadroKills: num(s, "Quadro Kills"),
    pentaKills: num(s, "Penta Kills"),
    clutch1v1Count: num(s, "1v1Count"),
    clutch1v1Wins: num(s, "1v1Wins"),
    clutch1v2Count: num(s, "1v2Count"),
    clutch1v2Wins: num(s, "1v2Wins"),
    clutchKills: num(s, "Clutch Kills"),
    entryCount: num(s, "Entry Count"),
    entryWins: num(s, "Entry Wins"),
    firstKills: num(s, "First Kills"),
    utilityDamage: num(s, "Utility Damage"),
    utilityCount: num(s, "Utility Count"),
    flashCount: num(s, "Flash Count"),
    enemiesFlashed: num(s, "Enemies Flashed"),
    flashSuccesses: num(s, "Flash Successes"),
    sniperKills: num(s, "Sniper Kills"),
  };
}

/** Normalize a match's stats. A CS2 match = one map (rounds[0]). */
export function normalizeMatchStats(
  matchId: string,
  raw: z.infer<typeof rawMatchStatsSchema>,
): FaceitMatchDetail | null {
  const round = raw.rounds[0];
  if (!round) return null;
  const players: FaceitMatchPlayer[] = [];
  const teams: FaceitMatchTeam[] = [];
  round.teams.forEach((team, i) => {
    for (const p of team.players) {
      players.push({
        playerId: p.player_id,
        nickname: p.nickname,
        result: num(p.player_stats, "Result"),
        stats: toStats(p.player_stats),
      });
    }
    teams.push({
      teamId: team.team_id ?? `team${i + 1}`,
      score: team.team_stats ? num(team.team_stats, "Final Score") : 0,
      playerIds: team.players.map((p) => p.player_id),
    });
  });
  return {
    matchId,
    map: round.round_stats["Map"] ?? "unknown",
    players,
    teams,
    winnerTeamId: round.round_stats["Winner"] ?? null,
  };
}
