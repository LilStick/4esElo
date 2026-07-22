import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, players, eloSnapshots, premierMatchStats } from "@4eselo/db";
import type { PremierSyncStore, PremierMatchResult } from "@4eselo/premier";

/** Store DB du sync Premier : courbe via elo_snapshots(source=premier), curseur sur players. */
export const dbPremierStore: PremierSyncStore = {
  async recordRating(playerId, rating, at) {
    const [last] = await db
      .select({ elo: eloSnapshots.elo })
      .from(eloSnapshots)
      .where(and(eq(eloSnapshots.playerId, playerId), eq(eloSnapshots.source, "premier")))
      .orderBy(desc(eloSnapshots.capturedAt))
      .limit(1);
    if (last?.elo === rating) return; // snapshot-on-change
    await db.insert(eloSnapshots).values({ playerId, source: "premier", elo: rating, capturedAt: at });
  },
  async recordMatchStats(playerId: string, shareCode: string, match: PremierMatchResult) {
    const row = {
      shareCode,
      playerId,
      map: match.map,
      playedAt: match.playedAt,
      result: match.result,
      ratingAfter: match.ratingAfter,
      myScore: match.myScore,
      oppScore: match.oppScore,
      stats: match.stats,
    };
    await db
      .insert(premierMatchStats)
      .values(row)
      .onConflictDoUpdate({
        target: [premierMatchStats.shareCode, premierMatchStats.playerId],
        set: row,
      });
  },

  async advanceCursor(playerId, shareCode, syncedAt) {
    await db
      .update(players)
      .set({ premierShareCode: shareCode, premierSyncedAt: syncedAt })
      .where(eq(players.id, playerId));
  },
};

export interface PremierConnectedMember {
  id: string;
  steamId64: string;
  authCodeEnc: string;
  shareCode: string;
  /** null = jamais synchronisé → 1er sync (on résout aussi le seed). */
  syncedAt: Date | null;
}

/** Membres ayant connecté leur compte Premier (auth code + share code présents). */
export async function getConnectedMembers(): Promise<PremierConnectedMember[]> {
  const rows = await db
    .select({
      id: players.id,
      steamId64: players.steamId64,
      enc: players.premierAuthCodeEnc,
      sc: players.premierShareCode,
      syncedAt: players.premierSyncedAt,
    })
    .from(players)
    .where(isNotNull(players.premierAuthCodeEnc));
  return rows
    .filter((r) => r.steamId64 && r.enc && r.sc)
    .map((r) => ({
      id: r.id,
      steamId64: r.steamId64!,
      authCodeEnc: r.enc!,
      shareCode: r.sc!,
      syncedAt: r.syncedAt,
    }));
}
