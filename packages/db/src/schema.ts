import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  index,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";
import type { FaceitMatchStats } from "@4eselo/types";

export const eloSource = pgEnum("elo_source", ["faceit", "premier"]);

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  discordId: text("discord_id").unique(),
  discordName: text("discord_name"),
  faceitId: text("faceit_id").unique(),
  faceitNickname: text("faceit_nickname"),
  steamId64: text("steam_id64"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Time series of ELO values, one row per capture. Feeds the ELO curves. */
export const eloSnapshots = pgTable(
  "elo_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    source: eloSource("source").notNull(),
    elo: integer("elo").notNull(),
    level: integer("level"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("elo_snapshots_player_source_idx").on(t.playerId, t.source, t.capturedAt)],
);

/** Per-match Faceit stats, used to backfill the curve and show match detail. */
export const faceitMatches = pgTable(
  "faceit_matches",
  {
    matchId: text("match_id").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    eloAfter: integer("elo_after"),
    result: integer("result"), // 1 = win, 0 = loss
    kills: integer("kills"),
    deaths: integer("deaths"),
    assists: integer("assists"),
    adr: integer("adr"),
    map: text("map"),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.playerId] }),
    index("faceit_matches_player_idx").on(t.playerId, t.playedAt),
  ],
);

/** Per-match player stats (one row per match per member). Key columns indexed,
 *  the full stat set kept in JSONB so new Faceit fields don't need a migration. */
export const faceitMatchStats = pgTable(
  "faceit_match_stats",
  {
    matchId: text("match_id").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    map: text("map").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    result: integer("result").notNull(), // 1 win, 0 loss
    eloAfter: integer("elo_after"),
    stats: jsonb("stats").$type<FaceitMatchStats>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.playerId] }),
    index("faceit_match_stats_player_played_idx").on(t.playerId, t.playedAt),
    index("faceit_match_stats_player_map_idx").on(t.playerId, t.map),
  ],
);

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type EloSnapshot = typeof eloSnapshots.$inferSelect;
export type FaceitMatch = typeof faceitMatches.$inferSelect;
export type FaceitMatchStat = typeof faceitMatchStats.$inferSelect;
export type NewFaceitMatchStat = typeof faceitMatchStats.$inferInsert;
