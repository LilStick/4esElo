import { db, eloSnapshots, faceitMatchStats, playtimeSnapshots } from "@4eselo/db";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { SnapshotStore } from "./sync";
import type { MatchStatsStore } from "./ingest";
import type { EloAfterStore } from "./eloAfter";
import type { PlaytimeStore } from "./playtime";
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
