import { execFile } from "node:child_process";

/**
 * curl renvoie `000` (→ 0) sans réponse HTTP (Cloudflare coupe, timeout, reset TLS).
 * `Response` rejette tout status hors 200-599 → on ramène à 503 (échec géré, pas throw).
 */
export function toResponseStatus(curlHttpCode: number): number {
  return curlHttpCode >= 200 && curlHttpCode <= 599 ? curlHttpCode : 503;
}

/**
 * Transport fetch-compatible via le curl système (HTTP/1.1) : le fingerprint TLS de
 * Node (undici) est bloqué par Cloudflare là où curl passe parfois. curl est présent
 * sur macOS/Linux/Windows 10+ ; sinon on retombe sur le fetch global.
 */
export function curlFetch(): typeof fetch {
  const impl = (async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const headers: string[] = [];
    for (const [k, v] of Object.entries((init?.headers as Record<string, string>) ?? {})) {
      headers.push("-H", `${k}: ${v}`);
    }
    const { status, body } = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      execFile(
        "curl",
        ["-s", "--http1.1", "--max-time", "15", "-w", "\n%{http_code}", ...headers, String(url)],
        { maxBuffer: 10 * 1024 * 1024 },
        (err, stdout) => {
          if (err && !stdout) return reject(err);
          const cut = stdout.lastIndexOf("\n");
          resolve({ status: Number(stdout.slice(cut + 1)) || 0, body: stdout.slice(0, cut) });
        },
      );
    });
    return new Response(body, { status: toResponseStatus(status) });
  }) as typeof fetch;
  return impl;
}
