import { DiscordError } from "./oauth";

/**
 * Webhook Discord (B17.7) - pattern provider : l'I/O réseau vit ici. Sert à
 * relayer les idées des membres dans un salon. Sécurité : `allowed_mentions`
 * vide → un texte utilisateur contenant @everyone/@here/pings ne ping personne.
 */

export interface DiscordWebhookMessage {
  title?: string;
  /** Corps du message - affiché tel quel (texte utilisateur), jamais interprété comme mention. */
  description: string;
  footer?: string;
}

/** Ce que l'app consomme - mockable en test. */
export interface DiscordWebhook {
  send(msg: DiscordWebhookMessage): Promise<void>;
}

export interface DiscordWebhookOptions {
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout (AbortController). */
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
        // Neutralise tout ping (@everyone/@here/rôles/membres) injecté dans le texte.
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new DiscordError(res.status, "/webhook");
  }
}
