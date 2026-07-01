import { db, eloSnapshots } from "@4eselo/db";
import { and, desc, eq } from "drizzle-orm";
import type { SnapshotStore } from "./sync";

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
