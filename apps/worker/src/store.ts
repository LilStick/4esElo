import { announcements, db, eloSnapshots, faceitMatchStats, players, playtimeSnapshots } from "@4eselo/db";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type { SnapshotStore } from "./sync";
import type { MatchStatsStore } from "./ingest";
import type { EloAfterStore } from "./eloAfter";
import type { PlaytimeStore } from "./playtime";
import type { BackfillStore } from "./backfillElo";
import type { AnnouncementStore, MonthActivityReader } from "./announceWrapped";
import { utcDay } from "./playtime";

/** Real SnapshotStore backed by Postgres via Drizzle. */
export const dbStore: SnapshotStore = {
  async getLatestElo(playerId, source) {
    const rows = await db
      .select({ elo: eloSnapshots.elo })
      .from(eloSnapshots)
      .where(and(eq(eloSnapshots.playerId, playerId), eq(eloSnapshots.source, source)))
      .orderBy(desc(eloSnapshots.capturedAt))
      .limit(1);
    return rows[0]?.elo ?? null;
  },

  async insertSnapshot(input) {
    await db.insert(eloSnapshots).values(input);
  },
};

/** Real BackfillStore backed by Postgres via Drizzle. */
export const dbBackfillStore: BackfillStore = {
  async getBackfillState(playerId) {
    const [row] = await db
      .select({
        attemptedAt: players.eloBackfillAttemptedAt,
        doneAt: players.eloBackfillDoneAt,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    return row ?? { attemptedAt: null, doneAt: null };
  },

  async markAttempt(playerId, at) {
    await db.update(players).set({ eloBackfillAttemptedAt: at }).where(eq(players.id, playerId));
  },

  async markDone(playerId, at) {
    await db.update(players).set({ eloBackfillDoneAt: at }).where(eq(players.id, playerId));
  },

  async setMatchElo(playerId, matchId, elo, delta) {
    await db
      .update(faceitMatchStats)
      .set({ eloAfter: elo, eloDelta: delta })
      .where(and(eq(faceitMatchStats.playerId, playerId), eq(faceitMatchStats.matchId, matchId)));
  },

  async getEarliestSnapshotAt(playerId) {
    const [row] = await db
      .select({ capturedAt: eloSnapshots.capturedAt })
      .from(eloSnapshots)
      .where(and(eq(eloSnapshots.playerId, playerId), eq(eloSnapshots.source, "faceit")))
      .orderBy(asc(eloSnapshots.capturedAt))
      .limit(1);
    return row?.capturedAt ?? null;
  },

  async insertSnapshots(rows) {
    await db.insert(eloSnapshots).values(rows.map((r) => ({ ...r, source: "faceit" as const })));
  },
};

/** Real PlaytimeStore backed by Postgres via Drizzle. */
export const dbPlaytimeStore: PlaytimeStore = {
  async getLastCapturedDay(playerId) {
    const rows = await db
      .select({ capturedAt: playtimeSnapshots.capturedAt })
      .from(playtimeSnapshots)
      .where(eq(playtimeSnapshots.playerId, playerId))
      .orderBy(desc(playtimeSnapshots.capturedAt))
      .limit(1);
    return rows[0] ? utcDay(rows[0].capturedAt) : null;
  },

  async insertPlaytime(playerId, minutesForever) {
    await db.insert(playtimeSnapshots).values({ playerId, minutesForever });
  },
};

/** Real AnnouncementStore + MonthActivityReader backed by Postgres via Drizzle. */
export const dbAnnouncementStore: AnnouncementStore & MonthActivityReader = {
  async insertUnique(a) {
    // dedupeKey unique : la relance du même mois est un no-op, pas une erreur.
    const rows = await db
      .insert(announcements)
      .values(a)
      .onConflictDoNothing()
      .returning({ id: announcements.id });
    return rows.length > 0;
  },

  async monthHasMatches(year, month) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const [row] = await db
      .select({ one: sql<number>`1` })
      .from(faceitMatchStats)
      .where(and(gte(faceitMatchStats.playedAt, start), lt(faceitMatchStats.playedAt, end)))
      .limit(1);
    return row !== undefined;
  },
};

/** Real MatchStatsStore backed by Postgres via Drizzle. */
export const dbMatchStatsStore: MatchStatsStore & EloAfterStore = {
  async setEloAfter(playerId, matchId, elo) {
    await db
      .update(faceitMatchStats)
      .set({ eloAfter: elo })
      .where(
        and(
          eq(faceitMatchStats.playerId, playerId),
          eq(faceitMatchStats.matchId, matchId),
          isNull(faceitMatchStats.eloAfter),
        ),
      );
  },

  async getStoredMatchIds(playerId, matchIds) {
    if (matchIds.length === 0) return new Set();
    const rows = await db
      .select({ matchId: faceitMatchStats.matchId })
      .from(faceitMatchStats)
      .where(and(eq(faceitMatchStats.playerId, playerId), inArray(faceitMatchStats.matchId, matchIds)));
    return new Set(rows.map((r) => r.matchId));
  },

  async insertMatchStats(row) {
    // The (matchId, playerId) PK already dedups; onConflictDoNothing makes a
    // concurrent or re-run insert a no-op instead of an error.
    await db.insert(faceitMatchStats).values(row).onConflictDoNothing();
  },
};
