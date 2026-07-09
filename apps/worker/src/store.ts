import {
  announcements,
  db,
  eloSnapshots,
  faceitMatchStats,
  matches,
  players,
  playtimeSnapshots,
} from "@4eselo/db";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { SnapshotStore } from "./sync";
import type { MatchStatsStore } from "./ingest";
import type { MatchLevelStore } from "./ingestMatches";
import type { DeepIngestStore } from "./deepIngest";
import type { EloAfterStore } from "./eloAfter";
import type { PlaytimeStore } from "./playtime";
import type { BackfillStore } from "./backfillElo";
import type { AnnouncementStore, MonthActivityReader } from "./announceWrapped";
import type { WeekActivityReader } from "./weeklyRecap";
import type { PeriodActivityReader } from "./announceBigWrapped";
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

/** Real AnnouncementStore + activity readers backed by Postgres via Drizzle. */
export const dbAnnouncementStore: AnnouncementStore &
  MonthActivityReader &
  WeekActivityReader &
  PeriodActivityReader = {
  async insertUnique(a) {
    // dedupeKey unique : la relance de la même période est un no-op, pas une erreur.
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

  async hasMatchesInRange(start, end) {
    const [row] = await db
      .select({ one: sql<number>`1` })
      .from(faceitMatchStats)
      .where(and(gte(faceitMatchStats.playedAt, start), lt(faceitMatchStats.playedAt, end)))
      .limit(1);
    return row !== undefined;
  },

  async weekActivity(start, end) {
    // Un membre par ligne pour ceux qui ont joué sur [start, end) : nb de games +
    // ±ELO (dernier snapshot faceit avant `end` moins celui avant `start`). Les
    // sous-requêtes de bornes ELO renvoient null si on n'a pas de point avant la
    // fenêtre (nouvel inscrit) → eloDelta null, exclu des classements gain/perte.
    // Bornes en ISO (le driver postgres.js ne bind pas les objets Date en SQL brut).
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const rows = await db.execute<{
      nickname: string | null;
      games: number;
      elo_start: number | null;
      elo_end: number | null;
    }>(sql`
      with played as (
        select fms.player_id, count(*)::int as games
        from faceit_match_stats fms
        where fms.played_at >= ${startIso} and fms.played_at < ${endIso}
        group by fms.player_id
      )
      select
        coalesce(p.faceit_nickname, p.discord_name) as nickname,
        pl.games,
        (select s.elo from elo_snapshots s
           where s.player_id = p.id and s.source = 'faceit' and s.captured_at < ${startIso}
           order by s.captured_at desc limit 1) as elo_start,
        (select s.elo from elo_snapshots s
           where s.player_id = p.id and s.source = 'faceit' and s.captured_at < ${endIso}
           order by s.captured_at desc limit 1) as elo_end
      from played pl
      join players p on p.id = pl.player_id
    `);
    return rows.map((r) => ({
      nickname: r.nickname ?? "Inconnu",
      games: Number(r.games),
      eloDelta: r.elo_start !== null && r.elo_end !== null ? Number(r.elo_end) - Number(r.elo_start) : null,
    }));
  },
};

/** Real MatchStatsStore backed by Postgres via Drizzle. */
export const dbMatchStatsStore: MatchStatsStore & EloAfterStore = {
  async setNewestMatchEloAfter(playerId, elo) {
    // Match le plus récent du joueur (match_id départage les ex æquo → stable).
    const [newest] = await db
      .select({ matchId: faceitMatchStats.matchId, eloAfter: faceitMatchStats.eloAfter })
      .from(faceitMatchStats)
      .where(eq(faceitMatchStats.playerId, playerId))
      .orderBy(desc(faceitMatchStats.playedAt), desc(faceitMatchStats.matchId))
      .limit(1);
    if (!newest || newest.eloAfter !== null) return null;
    await db
      .update(faceitMatchStats)
      .set({ eloAfter: elo })
      .where(
        and(
          eq(faceitMatchStats.playerId, playerId),
          eq(faceitMatchStats.matchId, newest.matchId),
          isNull(faceitMatchStats.eloAfter),
        ),
      );
    return newest.matchId;
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

/** Real MatchLevelStore (B4.3) backed by Postgres via Drizzle. */
export const dbMatchStore: MatchLevelStore = {
  async getMatchesToBackfill(limit) {
    // Matchs connus (faceit_match_stats) pas encore dans `matches`, une ligne
    // par matchId (played_at identique entre membres d'un même match).
    const rows = await db.execute<{ match_id: string; played_at: string }>(sql`
      select distinct on (fms.match_id) fms.match_id, fms.played_at
      from faceit_match_stats fms
      left join matches m on m.match_id = fms.match_id
      where m.match_id is null
      order by fms.match_id, fms.played_at
      limit ${limit}
    `);
    return rows.map((r) => ({ matchId: r.match_id, playedAt: new Date(r.played_at) }));
  },

  async insertMatch(row) {
    await db.insert(matches).values(row).onConflictDoNothing();
  },
};

/** Real DeepIngestStore (B17.11) backed by Postgres via Drizzle. */
export const dbDeepIngestStore: DeepIngestStore = {
  async getPlayersNeedingDeepIngest(limit) {
    const rows = await db
      .select({ id: players.id, faceitId: players.faceitId })
      .from(players)
      .where(and(isNull(players.deepIngestedAt), isNotNull(players.faceitId)))
      .limit(limit);
    return rows.map((r) => ({ id: r.id, faceitId: r.faceitId as string }));
  },

  async markDeepIngested(playerId, at) {
    await db.update(players).set({ deepIngestedAt: at }).where(eq(players.id, playerId));
  },
};
