import { z } from "zod";

/**
 * Client OAuth Discord (B17.1) - pattern provider : toute l'I/O réseau vers
 * Discord vit ici, validée par zod. Les apps consomment l'interface
 * `DiscordOAuth` (injectable → la logique auth se teste sans réseau).
 */

const API = "https://discord.com/api/v10";
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";

export class DiscordError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message?: string,
  ) {
    super(message ?? `Discord API ${status} on ${path}`);
    this.name = "DiscordError";
  }
}

const tokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
});

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  /** Pseudo serveur/global affichable, null si jamais défini. */
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

const guildsSchema = z.array(z.object({ id: z.string() }));

export interface DiscordUser {
  id: string;
  username: string;
  /** Le nom affichable (global_name sinon username). */
  displayName: string;
  avatar: string | null;
}

/** Ce que la logique auth consomme - mockable en test. */
export interface DiscordOAuth {
  authorizeUrl(state: string): string;
  /** Échange le `code` du callback contre un access token. */
  exchangeCode(code: string): Promise<string>;
  getUser(accessToken: string): Promise<DiscordUser>;
  /** L'utilisateur est-il membre du serveur (guild) donné ? */
  isGuildMember(accessToken: string, guildId: string): Promise<boolean>;
}

export interface DiscordOAuthOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout (AbortController). */
  timeoutMs?: number;
}

export class DiscordOAuthClient implements DiscordOAuth {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: DiscordOAuthOptions) {
    if (!opts.clientId || !opts.clientSecret || !opts.redirectUri) {
      throw new Error("DiscordOAuthClient requires clientId, clientSecret and redirectUri");
    }
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  authorizeUrl(state: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", this.opts.clientId);
    url.searchParams.set("redirect_uri", this.opts.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify guilds");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "none");
    return url.toString();
  }

  async exchangeCode(code: string): Promise<string> {
    const res = await this.fetchImpl(`${API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.opts.clientId,
        client_secret: this.opts.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.opts.redirectUri,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new DiscordError(res.status, "/oauth2/token");
    return tokenSchema.parse(await res.json()).access_token;
  }

  private async get(path: string, accessToken: string): Promise<unknown> {
    const res = await this.fetchImpl(API + path, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new DiscordError(res.status, path);
    return res.json();
  }

  async getUser(accessToken: string): Promise<DiscordUser> {
    const u = userSchema.parse(await this.get("/users/@me", accessToken));
    return {
      id: u.id,
      username: u.username,
      displayName: u.global_name ?? u.username,
      avatar: u.avatar ?? null,
    };
  }

  async isGuildMember(accessToken: string, guildId: string): Promise<boolean> {
    const guilds = guildsSchema.parse(await this.get("/users/@me/guilds", accessToken));
    return guilds.some((g) => g.id === guildId);
  }
}
