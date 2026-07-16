import { DiscordBotClient, type DiscordBot } from "@4eselo/discord";
import { DISCORD_BOT_TOKEN, DISCORD_ADMIN_CHANNEL_ID } from "./env";

// Notif Discord des actions admin (B17.13), best-effort : no-op si non configuré,
// et une erreur réseau ne fait jamais échouer l'action admin.
export const adminNotifyDeps: { bot: DiscordBot | null; channelId: string | null } = {
  bot: DISCORD_BOT_TOKEN ? new DiscordBotClient(DISCORD_BOT_TOKEN) : null,
  channelId: DISCORD_ADMIN_CHANNEL_ID ?? null,
};

export async function notifyAdminAction(title: string, description: string): Promise<void> {
  const { bot, channelId } = adminNotifyDeps;
  if (!bot || !channelId) return; // non configuré → silencieux
  try {
    await bot.postMessage(channelId, { title, description });
  } catch (err) {
    // Jamais bloquant : l'action admin a déjà réussi.
    console.error("[admin] notif Discord échouée:", err instanceof Error ? err.message : err);
  }
}
