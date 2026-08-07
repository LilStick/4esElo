import { z } from "zod";
import type { FaceitMatchStats } from "@4eselo/types";

/** Formes brutes de l'API Data v4 Faceit. On ne valide que les champs consommés ; le reste est ignoré. */

const cs2GameSchema = z.object({
  region: z.string().optional(),
  game_player_id: z.string().optional(), // Steam ID64
  game_player_name: z.string().optional(),
  // Optionnels depuis Season 8 : pendant les 10 matchs de placement le profil est
  // Unranked et l'ELO/level sont cachés → l'API peut les omettre ou renvoyer 0.
  // Les rendre requis ferait planter le parse (donc le sync) d'un joueur en placement.
  skill_level: z.number().optional(),
  faceit_elo: z.number().optional(),
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

export interface FaceitCs2Profile {
  /** ELO courant ; null en placement (Season 8+ : Unranked, ELO caché). */
  elo: number | null;
  /** Skill level 1-10 ; null en placement. */
  skillLevel: number | null;
  steamId64: string | null;
  /** true = 10 matchs de placement en cours (non classé, ELO/level cachés). */
  unranked: boolean;
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
  // `games.cs2` absent = n'a jamais joué CS2 (cs2 null, distinct du placement).
  // Sinon, convention Faceit : skill_level 0 (ou ELO/level absents) = Unranked, en
  // placement → on ne fabrique pas d'ELO à partir de rien (elo/skillLevel null).
  let cs2Profile: FaceitCs2Profile | null = null;
  if (cs2) {
    // Classé = ELO ET level présents et > 0. On exige `faceit_elo > 0` (pas seulement
    // skill_level) : l'API peut renvoyer 0 pour l'ELO caché en placement → sans ça un
    // 0 s'insérerait dans la courbe (la pollution que B19 veut éviter).
    const ranked =
      typeof cs2.faceit_elo === "number" &&
      cs2.faceit_elo > 0 &&
      typeof cs2.skill_level === "number" &&
      cs2.skill_level > 0;
    cs2Profile = {
      elo: ranked ? cs2.faceit_elo! : null,
      skillLevel: ranked ? cs2.skill_level! : null,
      steamId64: cs2.game_player_id ?? null,
      unranked: !ranked,
    };
  }
  return {
    playerId: raw.player_id,
    nickname: raw.nickname,
    avatar: raw.avatar || null,
    country: raw.country || null,
    cs2: cs2Profile,
  };
}

export function normalizeHistory(raw: z.infer<typeof rawHistorySchema>): FaceitMatchRef[] {
  return raw.items.map((it) => ({
    matchId: it.match_id,
    startedAt: new Date(it.started_at * 1000),
    finishedAt: it.finished_at ? new Date(it.finished_at * 1000) : null,
  }));
}

/** Stats de match : valeurs en strings, clés player_stats variables → parsing loose. */
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

/** Une équipe (faction) d'un match - vue match-level (B4.3, lineups). */
export interface FaceitMatchTeam {
  /** faction id Faceit (faction1/faction2), sinon fallback stable. */
  teamId: string;
  /** Score final de l'équipe (manches gagnées), 0 si indisponible. */
  score: number;
  playerIds: string[];
}

export interface FaceitMatchDetail {
  matchId: string;
  map: string;
  players: FaceitMatchPlayer[];
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

/** Un match CS2 = une map (rounds[0]). */
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
