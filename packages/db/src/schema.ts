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
  /** Cursus EFREI (ex. « Mastère Dev », « Licence », « Bachelor ») — libre, suggéré côté front. Register B17.2. */
  formation: text("formation"),
  /** Années de promo (ex. 2026-2028) ; Alumni 🎓 = promoEnd < année courante. */
  promoStart: integer("promo_start"),
  promoEnd: integer("promo_end"),
  /** Hash d'avatar Discord (rendu via cdn.discordapp.com), null si aucun. */
  discordAvatar: text("discord_avatar"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  /** Backfill ELO opportuniste (#141) : dernière tentative (1/jour max) et succès. */
  eloBackfillAttemptedAt: timestamp("elo_backfill_attempted_at", { withTimezone: true }),
  eloBackfillDoneAt: timestamp("elo_backfill_done_at", { withTimezone: true }),
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
    /** Vrai ±ELO du match (backfill #141) ; null tant que non récupéré. */
    eloDelta: integer("elo_delta"),
    stats: jsonb("stats").$type<FaceitMatchStats>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.playerId] }),
    index("faceit_match_stats_player_played_idx").on(t.playerId, t.playedAt),
    index("faceit_match_stats_player_map_idx").on(t.playerId, t.map),
  ],
);

/** Daily samples of lifetime CS2 playtime (Steam). Monthly playtime = diff
 *  between two samples — feeds the Wrapped ⏰ award (B7.1). */
export const playtimeSnapshots = pgTable(
  "playtime_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** null = échantillonné mais illisible (heures de jeu privées côté Steam). */
    minutesForever: integer("minutes_forever"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("playtime_snapshots_player_idx").on(t.playerId, t.capturedAt)],
);

/** Site announcements: the Wrapped monthly banner (B7.4), later the staff
 *  announce from the admin panel (B17.4). `type` stays text (not enum) so new
 *  kinds don't need a migration. */
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(), // "wrapped" | "staff" (B17.4)
    title: text("title").notNull(),
    /** Texte libre de l'annonce staff (B17.4) ; null pour le Wrapped (le lien suffit). */
    body: text("body"),
    /** Chemin interne du site (ex. /wrapped/juin-2026), null = annonce sans lien. */
    linkUrl: text("link_url"),
    /** Idempotence (ex. wrapped-2026-06) : l'unicité fait la dédup, relance sans doublon. */
    dedupeKey: text("dedupe_key").unique(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("announcements_published_idx").on(t.publishedAt)],
);

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type EloSnapshot = typeof eloSnapshots.$inferSelect;
export type FaceitMatchStat = typeof faceitMatchStats.$inferSelect;
export type NewFaceitMatchStat = typeof faceitMatchStats.$inferInsert;
export type PlaytimeSnapshot = typeof playtimeSnapshots.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
