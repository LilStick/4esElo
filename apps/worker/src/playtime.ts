import type { PlaytimeReader } from "@4eselo/steam";

/**
 * Daily playtime sampling (B7.1): one snapshot of lifetime CS2 minutes per
 * player per UTC day. Monthly playtime for the Wrapped ⏰ award = the diff
 * between two samples. Pure logic — Steam and the DB come in as interfaces.
 */

export interface PlaytimeStore {
  /** UTC day (YYYY-MM-DD) of the player's most recent snapshot, or null. */
  getLastCapturedDay(playerId: string): Promise<string | null>;
  /** minutesForever null = sampled but private — the front shows a hint. */
  insertPlaytime(playerId: string, minutesForever: number | null): Promise<void>;
}

export interface PlayerToSample {
  id: string;
  steamId64: string;
}

export interface PlaytimeResult {
  sampled: number;
  /** Already sampled today. */
  skipped: number;
  /** Playtime unreadable (private profile, Steam error). */
  failed: number;
}

export const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

export async function samplePlaytime(
  reader: PlaytimeReader,
  store: PlaytimeStore,
  playersToSample: PlayerToSample[],
  now: () => Date = () => new Date(),
): Promise<PlaytimeResult> {
  const result: PlaytimeResult = { sampled: 0, skipped: 0, failed: 0 };
  const today = utcDay(now());

  const due: PlayerToSample[] = [];
  for (const p of playersToSample) {
    if ((await store.getLastCapturedDay(p.id)) === today) result.skipped += 1;
    else due.push(p);
  }
  if (due.length === 0) return result;

  const playtimes = new Map(
    (await reader.getPlaytime(due.map((p) => p.steamId64))).map((p) => [p.steamId64, p.minutesForever]),
  );
  for (const p of due) {
    const minutes = playtimes.get(p.steamId64);
    // null is stored too: "sampled today, but private" — one row per day either way.
    await store.insertPlaytime(p.id, minutes ?? null);
    if (minutes === null || minutes === undefined) result.failed += 1;
    else result.sampled += 1;
  }
  return result;
}
