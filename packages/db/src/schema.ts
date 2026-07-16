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
import type { FaceitMatchStats, MatchTeam } from "@4eselo/types";

export const eloSource = pgEnum("elo_source", ["faceit", "premier"]);

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  discordId: text("discord_id").unique(),
  discordName: text("discord_name"),
  faceitId: text("faceit_id").unique(),
  faceitNickname: text("faceit_nickname"),
  steamId64: text("steam_id64"),
  /** Cursus EFREI (ex. « Mastère Dev », « Licence », « Bachelor ») - libre, suggéré côté front. Register B17.2. */
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
  /** Pull profond de l'historique fait (B17.11) ; null = à deep-ingérer (nouvel inscrit ou roster à rattraper). */
  deepIngestedAt: timestamp("deep_ingested_at", { withTimezone: true }),
});

/** Série temporelle d'ELO (une ligne par capture) → la courbe. */
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

/** Stats par match (une ligne par match/membre). Colonnes clés indexées, set complet en JSONB (pas de migration si nouveau champ Faceit). */
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
    // tri global par date (flux récents B15.11)
    index("faceit_match_stats_played_idx").on(t.playedAt),
  ],
);

/** Échantillons quotidiens du temps de jeu CS2 lifetime (Steam). Mensuel = diff entre 2 échantillons → award Wrapped ⏰ (B7.1). */
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

/** Annonces du site : bannière Wrapped (B7.4), annonce staff (B17.4). type reste text (pas enum) → nouveaux types sans migration. */
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

/** Boîte à idées (B17.7), relayée sur Discord. discord_id = auteur (session signée, non spoofable). */
export const ideas = pgTable(
  "ideas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordId: text("discord_id").notNull(),
    /** Nom d'affichage au moment du dépôt (dénormalisé pour la page). */
    discordName: text("discord_name"),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // rate-limit par membre (24 h) + fil récent global
    index("ideas_author_created_idx").on(t.discordId, t.createdAt),
    index("ideas_created_idx").on(t.createdAt),
  ],
);

/** Comptes Discord bannis (B17.9). readSession coupe même les sessions ouvertes ; le callback OAuth refuse le login. Clé = discord_id (pas de FK : on peut bannir un non-inscrit). */
export const bannedDiscordIds = pgTable("banned_discord_ids", {
  discordId: text("discord_id").primaryKey(),
  reason: text("reason"),
  /** discord_id de l'admin qui a posé le ban. */
  bannedBy: text("banned_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Vue match-level (B4.3) : une ligne par match (clé matchId), compo + score → lineups (B4.4). Complète faceit_match_stats (une ligne par match ET membre). */
export const matches = pgTable(
  "matches",
  {
    matchId: text("match_id").primaryKey(),
    map: text("map").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    /** team_id gagnant (faction), null si indéterminé. */
    winnerTeamId: text("winner_team_id"),
    /** Composition + score par équipe (taille variable) → JSONB. */
    teams: jsonb("teams").$type<MatchTeam[]>().notNull(),
  },
  (t) => [index("matches_played_idx").on(t.playedAt)],
);

/** Succès permanents débloqués (B7.8) : une ligne par (joueur, succès). Date figée à la 1re détection (onConflictDoNothing). */
export const achievements = pgTable(
  "achievements",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.achievementId] })],
);

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type EloSnapshot = typeof eloSnapshots.$inferSelect;
export type FaceitMatchStat = typeof faceitMatchStats.$inferSelect;
export type NewFaceitMatchStat = typeof faceitMatchStats.$inferInsert;
export type PlaytimeSnapshot = typeof playtimeSnapshots.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
export type BannedDiscordId = typeof bannedDiscordIds.$inferSelect;
export type NewBannedDiscordId = typeof bannedDiscordIds.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
