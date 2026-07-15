import { ingestPlayerMatches, type MatchReader, type MatchStatsStore, type PlayerToIngest } from "./ingest";

/**
 * Deep-ingest à l'inscription (B17.11) : à l'arrivée d'un membre (et en rattrapage
 * du roster), on tire tout l'historique Faceit dispo une bonne fois (fenêtre large,
 * cap élevé), au lieu de la fenêtre glissante de 90 j de l'ingest incrémental.
 * Best-effort : on marque le joueur fait après la passe ; l'incrémental entretient
 * ensuite. Réutilise ingestPlayerMatches (déjà testé) - le réseau/DB sont injectés.
 */

export interface DeepIngestStore {
  /** Joueurs jamais deep-ingérés (deep_ingested_at null), avec un faceitId. */
  getPlayersNeedingDeepIngest(limit: number): Promise<PlayerToIngest[]>;
  markDeepIngested(playerId: string, at: Date): Promise<void>;
}

export interface DeepIngestOptions {
  /** Joueurs deep-ingérés par run (1 par défaut : c'est lourd). */
  maxPlayers?: number;
  /** Profondeur de la fenêtre (par défaut ~10 ans = tout l'historique). */
  windowDays?: number;
  maxMatches?: number;
  throttleMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface DeepIngestResult {
  players: number;
  inserted: number;
}

export async function deepIngestPlayers(
  reader: MatchReader,
  matchStore: MatchStatsStore,
  deepStore: DeepIngestStore,
  opts: DeepIngestOptions = {},
): Promise<DeepIngestResult> {
  const maxPlayers = opts.maxPlayers ?? 1;
  const now = opts.now ?? (() => new Date());

  const players = await deepStore.getPlayersNeedingDeepIngest(maxPlayers);
  const result: DeepIngestResult = { players: 0, inserted: 0 };

  for (const p of players) {
    const res = await ingestPlayerMatches(reader, matchStore, p, {
      windowDays: opts.windowDays ?? 3650,
      maxMatches: opts.maxMatches ?? 2000,
      throttleMs: opts.throttleMs,
      sleep: opts.sleep,
      now: opts.now,
    });
    // Marqué fait même si la passe a été partielle : l'incrémental (90 j) prend le
    // relais, et re-deep-ingérer ne rapporterait que du très vieux (cap 2000).
    await deepStore.markDeepIngested(p.id, now());
    result.players += 1;
    result.inserted += res.inserted;
  }
  return result;
}
