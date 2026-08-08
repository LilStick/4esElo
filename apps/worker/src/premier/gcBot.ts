import SteamUser from "steam-user";
import SteamTotp from "steam-totp";
// globaloffensive n'expose pas de types → import CommonJS typé localement.
import GlobalOffensive from "globaloffensive";
import { decodeShareCode } from "@4eselo/premier";
import { createGcWatchdog, type GcWatchdog } from "./gcWatchdog";

/**
 * Bot Steam headless à session longue durée : reste connecté au Game Coordinator
 * CS2 et résout des share codes en infos de match (URL de démo). Un seul compte
 * = une seule session GC → les appels sont sérialisés (un match à la fois).
 */

export interface GcBotCreds {
  username: string;
  password: string;
  sharedSecret: string;
}

export interface GcMatchInfo {
  /** URL de la démo (.dem.bz2) ; null si absente (match annulé, etc.). */
  demoUrl: string | null;
  /** reservation.game_type (permet de distinguer Premier du reste). */
  gameType: number | null;
  /** Date du match (unix → Date), null si inconnue. */
  playedAt: Date | null;
}

export interface GcBot {
  /** Résolue quand le GC est prêt (rejette si login échoue). */
  ready(): Promise<void>;
  /** Résout un share code en infos de match. Sérialisé. */
  requestMatch(shareCode: string, timeoutMs?: number): Promise<GcMatchInfo>;
  shutdown(): void;
}

export interface GcBotOptions {
  /**
   * Watchdog : si le GC reste déconnecté au-delà, on abandonne (défaut : exit
   * process → redémarrage à froid par l'orchestrateur, qui lui est fiable).
   * Défaut 5 min. Une déco brève se répare seule bien avant.
   */
  gcDownExitMs?: number;
  /**
   * Nb de timeouts `requestMatch` consécutifs au-delà duquel on considère le GC
   * « gelé » (socket vivant, `gcReady=true`, mais `requestGame` muet → aucun event
   * `disconnectedFromGC` ne l'aurait détecté) et on arme l'abandon via le watchdog.
   * Défaut 3.
   */
  gcMaxTimeouts?: number;
  /** Injectable pour tests : watchdog déjà construit (sinon défaut = exit process). */
  watchdog?: GcWatchdog;
}

export function createGcBot(creds: GcBotCreds, opts: GcBotOptions = {}): GcBot {
  const client = new SteamUser();
  const csgo = new GlobalOffensive(client);
  let gcReady = false;
  const watchdog =
    opts.watchdog ??
    createGcWatchdog({
      downMs: opts.gcDownExitMs ?? 5 * 60_000,
      onTimeout: (ms) => {
        console.error(
          `[premier-bot] GC déconnecté depuis > ${Math.round(ms / 1000)}s sans reprise - abandon du process pour un redémarrage à froid`,
        );
        process.exit(1);
      },
    });
  // Gel « socket vivant » : le watchdog ci-dessus n'écoute que les events de
  // connexion ; si la session reste gcReady=true mais que requestGame ne répond
  // plus, aucun markDown n'est émis. On arme donc l'abandon après N timeouts d'affilée.
  const timeoutTracker = createTimeoutTracker(opts.gcMaxTimeouts ?? 3, () => {
    console.error(
      "[premier-bot] GC gelé : trop de timeouts requestMatch consécutifs (socket vivant, requestGame muet) - armement de l'abandon",
    );
    watchdog.markDown();
  });

  let resolveReady!: () => void;
  let rejectReady!: (e: Error) => void;
  const readyP = new Promise<void>((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });

  client.on("error", (e: Error) => {
    if (!gcReady) rejectReady(e);
    else console.error("[premier-bot] erreur Steam:", e.message);
  });
  client.on("steamGuard", () => {
    rejectReady(new Error("Steam Guard demandé - STEAM_BOT_SHARED_SECRET invalide ?"));
  });
  client.on("loggedOn", () => {
    console.log("[premier-bot] logged on, lancement CS2…");
    client.setPersona(SteamUser.EPersonaState.Online);
    client.gamesPlayed([730]);
  });
  csgo.on("connectedToGC", () => {
    console.log("[premier-bot] connecté au GC");
    gcReady = true;
    watchdog.markUp(); // reconnexion : on désarme le compte à rebours d'abandon
    resolveReady();
  });
  csgo.on("disconnectedFromGC", () => {
    gcReady = false;
    console.warn("[premier-bot] déconnecté du GC, relance…");
    watchdog.markDown(); // arme l'abandon si la reconnexion ne revient pas
    client.gamesPlayed([730]);
  });

  let chain: Promise<unknown> = Promise.resolve();

  function requestMatch(shareCode: string, timeoutMs = 30000): Promise<GcMatchInfo> {
    // sérialise : un requestGame à la fois (l'event matchList est global).
    const expectedMatchId = decodeMatchId(shareCode);
    const run = chain.then(
      () =>
        new Promise<GcMatchInfo>((resolve, reject) => {
          if (!gcReady) return reject(new Error("GC non connecté"));
          const timer = setTimeout(() => {
            csgo.removeListener("matchList", onList);
            timeoutTracker.recordTimeout();
            reject(new Error(`timeout GC pour ${shareCode}`));
          }, timeoutMs);
          const onList = (matches: unknown) => {
            // matchList est un event GLOBAL non corrélé : un event en retard d'une
            // requête précédente (qui a timeout) peut arriver pendant celle-ci. On
            // l'ignore s'il concerne un autre match (corrélation par matchid).
            if (isStaleMatchList(expectedMatchId, matches)) return;
            clearTimeout(timer);
            csgo.removeListener("matchList", onList);
            timeoutTracker.recordSuccess();
            resolve(extractMatchInfo(matches));
          };
          csgo.on("matchList", onList);
          csgo.requestGame(shareCode);
        }),
    );
    chain = run.catch(() => undefined);
    return run;
  }

  console.log(`[premier-bot] connexion Steam (${creds.username})…`);
  client.logOn({
    accountName: creds.username,
    password: creds.password,
    twoFactorCode: SteamTotp.generateAuthCode(creds.sharedSecret),
  });

  return {
    ready: () => readyP,
    requestMatch,
    shutdown: () => client.logOff(),
  };
}

/** Extrait {demoUrl, gameType, playedAt} de la réponse matchList du GC. */
export function extractMatchInfo(matches: unknown): GcMatchInfo {
  const m = Array.isArray(matches) ? (matches[0] as Record<string, unknown> | undefined) : undefined;
  if (!m) return { demoUrl: null, gameType: null, playedAt: null };
  const rounds = (m.roundstatsall as Array<Record<string, unknown>> | undefined) ?? [];
  const demoUrl =
    rounds.map((r) => r.map).find((u): u is string => typeof u === "string" && u.includes(".dem")) ?? null;
  const last = rounds[rounds.length - 1];
  const reservation = last?.reservation as Record<string, unknown> | undefined;
  const gameType = typeof reservation?.game_type === "number" ? reservation.game_type : null;
  const matchtime = typeof m.matchtime === "number" ? m.matchtime : null;
  return { demoUrl, gameType, playedAt: matchtime ? new Date(matchtime * 1000) : null };
}

/** matchId attendu d'un share code ; null si le code est illisible (pas de corrélation). */
export function decodeMatchId(shareCode: string): bigint | null {
  try {
    return decodeShareCode(shareCode).matchId;
  } catch {
    return null; // share code invalide → on ne peut pas corréler, on n'exclut rien
  }
}

/** matchId porté par une réponse matchList du GC ; null si absent/illisible. */
export function matchListMatchId(matches: unknown): bigint | null {
  const m = Array.isArray(matches) ? (matches[0] as Record<string, unknown> | undefined) : undefined;
  const raw = m?.matchid;
  if (raw == null) return null;
  try {
    return BigInt(String(raw));
  } catch {
    return null; // format inattendu → on ne conclut pas
  }
}

/**
 * Un event matchList est « périmé » (d'une requête précédente qui a timeout) si on
 * peut lire les DEUX matchid et qu'ils diffèrent. Défensif : si l'un des deux est
 * illisible, on ne conclut PAS (on accepte) pour ne pas casser le chemin heureux.
 */
export function isStaleMatchList(expected: bigint | null, matches: unknown): boolean {
  const got = matchListMatchId(matches);
  return expected !== null && got !== null && got !== expected;
}

export interface TimeoutTracker {
  recordTimeout(): void;
  recordSuccess(): void;
}

/**
 * Compte les timeouts consécutifs ; au `threshold`-ième d'affilée, appelle `onTrip`
 * et se réarme. Un succès remet le compteur à zéro. Pur, testable.
 */
export function createTimeoutTracker(threshold: number, onTrip: () => void): TimeoutTracker {
  let count = 0;
  return {
    recordTimeout() {
      count++;
      if (count >= threshold) {
        count = 0;
        onTrip();
      }
    },
    recordSuccess() {
      count = 0;
    },
  };
}
