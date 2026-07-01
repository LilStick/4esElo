import { z } from "zod";

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
