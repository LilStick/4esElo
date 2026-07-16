import { and, eq, gte, lt } from "drizzle-orm";
import { db, eloSnapshots, faceitMatchStats, players, playtimeSnapshots } from "@4eselo/db";
import { monthRange, type WrappedInputs } from "./wrapped";

/** Inputs du moteur d'awards pour un mois (B7.2) ; partagé /wrapped ↔ admin regenerate (B17.4). */
export async function loadWrappedInputs(year: number, month: number): Promise<WrappedInputs> {
  const { start, end } = monthRange(year, month);
  return loadWrappedInputsForRange(start, end);
}

/** Idem sur fenêtre [start, end) arbitraire (BIG Wrapped, B7.12). */
export async function loadWrappedInputsForRange(start: Date, end: Date): Promise<WrappedInputs> {
  const playerRows = await db
    .select({
      id: players.id,
      faceitNickname: players.faceitNickname,
      discordName: players.discordName,
      discordId: players.discordId,
      discordAvatar: players.discordAvatar,
    })
    .from(players);

  const matches = await db
    .select({
      playerId: faceitMatchStats.playerId,
      map: faceitMatchStats.map,
      playedAt: faceitMatchStats.playedAt,
      result: faceitMatchStats.result,
      stats: faceitMatchStats.stats,
    })
    .from(faceitMatchStats)
    .where(and(gte(faceitMatchStats.playedAt, start), lt(faceitMatchStats.playedAt, end)));

  const elo = await db
    .select({
      playerId: eloSnapshots.playerId,
      elo: eloSnapshots.elo,
      capturedAt: eloSnapshots.capturedAt,
    })
    .from(eloSnapshots)
    .where(
      and(
        eq(eloSnapshots.source, "faceit"),
        gte(eloSnapshots.capturedAt, start),
        lt(eloSnapshots.capturedAt, end),
      ),
    );

  const playtime = await db
    .select({
      playerId: playtimeSnapshots.playerId,
      minutesForever: playtimeSnapshots.minutesForever,
      capturedAt: playtimeSnapshots.capturedAt,
    })
    .from(playtimeSnapshots)
    .where(and(gte(playtimeSnapshots.capturedAt, start), lt(playtimeSnapshots.capturedAt, end)));

  return {
    players: playerRows.map((p) => ({
      id: p.id,
      nickname: p.faceitNickname ?? p.discordName ?? p.id,
      discordId: p.discordId,
      discordAvatar: p.discordAvatar,
    })),
    matches,
    eloSnapshots: elo,
    playtimeSnapshots: playtime,
  };
}
