import type { PlaytimeReader } from "@4eselo/steam";

/**
 * Échantillon quotidien de temps de jeu (B7.1) : un snapshot des minutes CS2
 * lifetime par joueur/jour UTC. Le temps mensuel (award Wrapped ⏰) = diff entre
 * deux échantillons. Pure logic - Steam et DB en interfaces.
 */

export interface PlaytimeStore {
  /** Jour UTC (YYYY-MM-DD) du snapshot le plus récent, ou null. */
  getLastCapturedDay(playerId: string): Promise<string | null>;
  /** minutesForever null = échantillonné mais privé - le front affiche un hint. */
  insertPlaytime(playerId: string, minutesForever: number | null): Promise<void>;
}

export interface PlayerToSample {
  id: string;
  steamId64: string;
}

export interface PlaytimeResult {
  sampled: number;
  /** Déjà échantillonné aujourd'hui. */
  skipped: number;
  /** Temps illisible (profil privé, erreur Steam). */
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
    // null aussi stocké : "échantillonné aujourd'hui mais privé" - une ligne/jour.
    await store.insertPlaytime(p.id, minutes ?? null);
    if (minutes === null || minutes === undefined) result.failed += 1;
    else result.sampled += 1;
  }
  return result;
}
