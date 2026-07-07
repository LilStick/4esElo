/** URL CDN d'un avatar Discord (hash + user id → image). null si pas d'avatar. */
export function discordAvatarUrl(
  discordId: string | null | undefined,
  hash: string | null | undefined,
): string | null {
  if (!discordId || !hash) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.png?size=64`;
}
