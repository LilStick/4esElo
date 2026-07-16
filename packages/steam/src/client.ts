import { z } from "zod";

/**
 * Présence Steam - qui est en ligne / en CS2. Deux chemins, même sortie :
 *  - Avec STEAM_API_KEY : GetPlayerSummaries (batch ≤ 100 ids ; gameserverip → serveur communautaire ≈ Faceit).
 *  - Sans clé : profil XML public, un fetch par id (pas d'info serveur). OK pour le dev.
 * Les deux dépendent de la vie privée Steam (« détails du jeu » public), sinon = pas-en-jeu.
 */

const CS2_APP_ID = "730";
const API = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/";
const OWNED_GAMES = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";
const COMMUNITY = "https://steamcommunity.com/profiles";

export class SteamError extends Error {
  constructor(
    readonly status: number,
    message?: string,
  ) {
    super(message ?? `Steam API ${status}`);
    this.name = "SteamError";
  }
}

export interface SteamPresence {
  steamId64: string;
  /** null = profile unreadable (private, deleted, fetch error). */
  online: boolean | null;
  inGameCs2: boolean;
  /** true = on a community server (≈ Faceit); null = unknown (keyless path). */
  onCommunityServer: boolean | null;
}

export interface PresenceReader {
  getPresence(steamIds: string[]): Promise<SteamPresence[]>;
}

export interface SteamPlaytime {
  steamId64: string;
  /** Lifetime CS2 minutes; null when unreadable (private profile, error). */
  minutesForever: number | null;
}

export interface PlaytimeReader {
  getPlaytime(steamIds: string[]): Promise<SteamPlaytime[]>;
}

const ownedGamesSchema = z.object({
  response: z.object({
    games: z.array(z.object({ appid: z.number(), playtime_forever: z.number() })).optional(),
  }),
});

const summariesSchema = z.object({
  response: z.object({
    players: z.array(
      z.object({
        steamid: z.string(),
        personastate: z.number(),
        gameid: z.string().optional(),
        gameserverip: z.string().optional(),
      }),
    ),
  }),
});

export interface SteamClientOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class SteamClient implements PresenceReader {
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: SteamClientOptions = {}) {
    this.apiKey = opts.apiKey || undefined;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async getPresence(steamIds: string[]): Promise<SteamPresence[]> {
    if (steamIds.length === 0) return [];
    return this.apiKey ? this.viaApi(steamIds, this.apiKey) : this.viaXml(steamIds);
  }

  /** Temps de jeu CS2 lifetime, un appel par id (pas de batch ici). Requiert une clé. */
  async getPlaytime(steamIds: string[]): Promise<SteamPlaytime[]> {
    if (!this.apiKey) throw new SteamError(401, "getPlaytime requires STEAM_API_KEY");
    const out: SteamPlaytime[] = [];
    for (const id of steamIds) {
      try {
        const url = new URL(OWNED_GAMES);
        url.searchParams.set("key", this.apiKey);
        url.searchParams.set("steamid", id);
        url.searchParams.set("appids_filter[0]", CS2_APP_ID);
        const res = await this.fetchImpl(url);
        if (!res.ok) throw new SteamError(res.status);
        const { response } = ownedGamesSchema.parse(await res.json());
        const cs2 = response.games?.find((g) => String(g.appid) === CS2_APP_ID);
        out.push({ steamId64: id, minutesForever: cs2?.playtime_forever ?? null });
      } catch {
        out.push({ steamId64: id, minutesForever: null });
      }
    }
    return out;
  }

  private async viaApi(steamIds: string[], apiKey: string): Promise<SteamPresence[]> {
    const out: SteamPresence[] = [];
    for (let i = 0; i < steamIds.length; i += 100) {
      const batch = steamIds.slice(i, i + 100);
      const url = new URL(API);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("steamids", batch.join(","));
      const res = await this.fetchImpl(url);
      if (!res.ok) throw new SteamError(res.status);
      const { response } = summariesSchema.parse(await res.json());
      const byId = new Map(response.players.map((p) => [p.steamid, p]));
      for (const id of batch) {
        const p = byId.get(id);
        if (!p) {
          // Steam masque les profils privés → inconnu, pas hors-ligne.
          out.push({ steamId64: id, online: null, inGameCs2: false, onCommunityServer: null });
          continue;
        }
        const inGameCs2 = p.gameid === CS2_APP_ID;
        out.push({
          steamId64: id,
          online: p.personastate > 0,
          inGameCs2,
          onCommunityServer: inGameCs2 ? Boolean(p.gameserverip && p.gameserverip !== "0.0.0.0:0") : null,
        });
      }
    }
    return out;
  }

  private async viaXml(steamIds: string[]): Promise<SteamPresence[]> {
    const out: SteamPresence[] = [];
    for (const id of steamIds) {
      try {
        const res = await this.fetchImpl(`${COMMUNITY}/${id}/?xml=1`);
        if (!res.ok) throw new SteamError(res.status);
        const xml = await res.text();
        const state = /<onlineState>([^<]*)<\/onlineState>/.exec(xml)?.[1] ?? null;
        const message = /<stateMessage><!\[CDATA\[([^\]]*)\]\]><\/stateMessage>/.exec(xml)?.[1] ?? "";
        if (state === null) {
          out.push({ steamId64: id, online: null, inGameCs2: false, onCommunityServer: null });
          continue;
        }
        out.push({
          steamId64: id,
          online: state !== "offline",
          inGameCs2: state === "in-game" && message.includes("Counter-Strike 2"),
          onCommunityServer: null, // the XML never exposes the server
        });
      } catch {
        out.push({ steamId64: id, online: null, inGameCs2: false, onCommunityServer: null });
      }
    }
    return out;
  }
}
