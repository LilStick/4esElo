import { DiscordError } from "./oauth";

/** Webhook Discord (B17.7) - relaie les idées des membres. allowed_mentions vide → pas de ping même si le texte contient @everyone/@here. */

export interface DiscordWebhookMessage {
  title?: string;
  /** Corps du message - affiché tel quel (texte utilisateur), jamais interprété comme mention. */
  description: string;
  footer?: string;
}

export interface DiscordWebhook {
  send(msg: DiscordWebhookMessage): Promise<void>;
}

export interface DiscordWebhookOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class DiscordWebhookClient implements DiscordWebhook {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly url: string,
    opts: DiscordWebhookOptions = {},
  ) {
    if (!url) throw new Error("DiscordWebhookClient requires a webhook URL");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  async send(msg: DiscordWebhookMessage): Promise<void> {
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: msg.title,
            description: msg.description,
            color: 5793266,
            ...(msg.footer ? { footer: { text: msg.footer } } : {}),
          },
        ],
        // neutralise tout ping injecté dans le texte
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new DiscordError(res.status, "/webhook");
  }
}
