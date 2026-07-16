import { FaceitError, eloToLevel, type EloHistoryProvider } from "@4eselo/faceit";

/**
 * Backfill ELO opportuniste (B2.10) : une tentative polie/joueur/jour UTC contre
 * l'endpoint d'historique NON OFFICIEL (fragile). 200 = tout l'historique d'un coup
 * (eloAfter/eloDelta par match + courbe rétro) ; 403 = "pas aujourd'hui", silencieux,
 * retenté demain. Jamais bloquant : le pipeline forward (#93) tourne quoi qu'il arrive.
 */

export interface BackfillStore {
  /** null = never attempted. */
  getBackfillState(playerId: string): Promise<{ attemptedAt: Date | null; doneAt: Date | null }>;
  markAttempt(playerId: string, at: Date): Promise<void>;
  markDone(playerId: string, at: Date): Promise<void>;
  /** Real data overwrites the tick heuristic. */
  setMatchElo(playerId: string, matchId: string, elo: number, delta: number | null): Promise<void>;
  /** capturedAt du snapshot le PLUS ANCIEN, null si courbe vide. */
  getEarliestSnapshotAt(playerId: string): Promise<Date | null>;
  insertSnapshots(rows: { playerId: string; elo: number; level: number; capturedAt: Date }[]): Promise<void>;
}

export interface PlayerToBackfill {
  id: string;
  faceitId: string;
}

export type BackfillResult =
  | { status: "done-already" }
  | { status: "attempted-today" }
  | { status: "blocked" } // 403 - retry tomorrow
  | { status: "ok"; matchesFilled: number; snapshotsInserted: number };

const sameUtcDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

export async function backfillPlayerElo(
  provider: EloHistoryProvider,
  store: BackfillStore,
  player: PlayerToBackfill,
  now: () => Date = () => new Date(),
): Promise<BackfillResult> {
  const state = await store.getBackfillState(player.id);
  if (state.doneAt) return { status: "done-already" };
  if (state.attemptedAt && sameUtcDay(state.attemptedAt, now())) {
    return { status: "attempted-today" };
  }

  await store.markAttempt(player.id, now());
  let points;
  try {
    points = await provider.getEloHistory(player.faceitId);
  } catch (err) {
    if (err instanceof FaceitError) return { status: "blocked" };
    throw err; // programming/DB errors must not be absorbed
  }

  let matchesFilled = 0;
  for (const p of points) {
    if (!p.matchId) continue;
    await store.setMatchElo(player.id, p.matchId, p.elo, p.eloDelta);
    matchesFilled += 1;
  }

  // Courbe rétro : seulement AVANT le début de la courbe live (jamais de collision
  // avec les snapshots live ni entre re-runs). Chronologique + change-only.
  const earliest = await store.getEarliestSnapshotAt(player.id);
  const retro = points
    .filter((p) => earliest === null || p.date < earliest)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const rows: { playerId: string; elo: number; level: number; capturedAt: Date }[] = [];
  let prevElo: number | null = null;
  for (const p of retro) {
    if (p.elo === prevElo) continue;
    rows.push({ playerId: player.id, elo: p.elo, level: eloToLevel(p.elo), capturedAt: p.date });
    prevElo = p.elo;
  }
  if (rows.length > 0) await store.insertSnapshots(rows);

  await store.markDone(player.id, now());
  return { status: "ok", matchesFilled, snapshotsInserted: rows.length };
}
