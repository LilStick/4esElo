/**
 * Avatar Discord : URL CDN (pur) + récupération best-effort en data URI pour
 * l'embarquer dans un SVG (carte de partage OG, B5.4). Le fetch est isolé ici
 * (les apps n'ont pas le droit de fetch en direct) et injectable pour les tests.
 */

/** URL CDN de l'avatar. `size` doit être une puissance de 2 (16…4096). */
export function discordAvatarUrl(discordId: string, hash: string, size = 256): string {
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.png?size=${size}`;
}

export interface FetchAvatarOptions {
  /** Injectable pour les tests ; défaut = fetch global. */
  fetchImpl?: typeof fetch;
  size?: number;
  timeoutMs?: number;
}

/**
 * Télécharge l'avatar et le renvoie en `data:image/…;base64,…`, ou `null` si
 * quoi que ce soit échoue (CDN down, timeout, hash mort) - l'appelant retombe
 * alors sur une carte dégradée, ce n'est jamais une erreur bloquante.
 */
export async function fetchAvatarDataUri(
  discordId: string,
  hash: string,
  opts: FetchAvatarOptions = {},
): Promise<string | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = discordAvatarUrl(discordId, hash, opts.size ?? 256);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 4000);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) return null;
    const mime = res.headers.get("content-type") ?? "image/png";
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    // Best-effort : réseau / timeout / avatar supprimé → null = carte dégradée.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
