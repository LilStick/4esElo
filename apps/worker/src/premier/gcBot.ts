import SteamUser from "steam-user";
import SteamTotp from "steam-totp";
// globaloffensive n'expose pas de types → import CommonJS typé localement.
import GlobalOffensive from "globaloffensive";

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

export function createGcBot(creds: GcBotCreds): GcBot {
  const client = new SteamUser();
  const csgo = new GlobalOffensive(client);
  let gcReady = false;
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
    resolveReady();
  });
  csgo.on("disconnectedFromGC", () => {
    gcReady = false;
    console.warn("[premier-bot] déconnecté du GC, relance…");
    client.gamesPlayed([730]);
  });

  let chain: Promise<unknown> = Promise.resolve();

  function requestMatch(shareCode: string, timeoutMs = 30000): Promise<GcMatchInfo> {
    // sérialise : un requestGame à la fois (l'event matchList est global).
    const run = chain.then(
      () =>
        new Promise<GcMatchInfo>((resolve, reject) => {
          if (!gcReady) return reject(new Error("GC non connecté"));
          const timer = setTimeout(() => {
            csgo.removeListener("matchList", onList);
            reject(new Error(`timeout GC pour ${shareCode}`));
          }, timeoutMs);
          const onList = (matches: unknown) => {
            clearTimeout(timer);
            csgo.removeListener("matchList", onList);
            resolve(extractMatchInfo(matches));
          };
          csgo.on("matchList", onList);
          csgo.requestGame(shareCode);
        }),
    );
    chain = run.catch(() => undefined);
    return run;
  }

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
