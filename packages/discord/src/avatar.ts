/** Avatar Discord : URL CDN + fetch best-effort en data URI pour l'embarquer dans un SVG (carte OG, B5.4). */

/** URL CDN de l'avatar. `size` doit être une puissance de 2 (16…4096). */
export function discordAvatarUrl(discordId: string, hash: string, size = 256): string {
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.png?size=${size}`;
}

export interface FetchAvatarOptions {
  fetchImpl?: typeof fetch;
  size?: number;
  timeoutMs?: number;
}

/** Avatar en data URI base64, ou null si échec (CDN down, timeout, hash mort) - best-effort, jamais bloquant. */
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
    // best-effort : échec → null (carte dégradée)
    return null;
  } finally {
    clearTimeout(timer);
  }
}
