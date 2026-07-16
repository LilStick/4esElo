import { DiscordError } from "./oauth";

/**
 * Client bot Discord (REST v10). Poste une idée dans un salon PUIS amorce les réactions
 * de vote (✅/❌), ce qu'un webhook ne peut pas faire (B17.12). allowed_mentions vide → pas de ping.
 */
const API = "https://discord.com/api/v10";

export interface DiscordBotMessage {
  title?: string;
  /** Corps affiché tel quel (texte utilisateur), jamais interprété comme mention. */
  description: string;
  footer?: string;
}

export interface DiscordBot {
  postMessage(channelId: string, msg: DiscordBotMessage): Promise<string>;
  react(channelId: string, messageId: string, emoji: string): Promise<void>;
}

export interface DiscordBotOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class DiscordBotClient implements DiscordBot {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly token: string,
    opts: DiscordBotOptions = {},
  ) {
    if (!token) throw new Error("DiscordBotClient requires a bot token");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  async postMessage(channelId: string, msg: DiscordBotMessage): Promise<string> {
    const res = await this.fetchImpl(`${API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: msg.title,
            description: msg.description,
            color: 5793266,
            ...(msg.footer ? { footer: { text: msg.footer } } : {}),
          },
        ],
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new DiscordError(res.status, "/channels/messages");
    const body = (await res.json()) as { id: string };
    return body.id;
  }

  async react(channelId: string, messageId: string, emoji: string): Promise<void> {
    const res = await this.fetchImpl(
      `${API}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
      {
        method: "PUT",
        headers: { Authorization: `Bot ${this.token}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );
    if (!res.ok) throw new DiscordError(res.status, "/reactions");
  }
}
