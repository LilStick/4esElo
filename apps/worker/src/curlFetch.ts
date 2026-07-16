import { execFile } from "node:child_process";

/**
 * curl renvoie `000` (→ 0 ici) quand il n'obtient aucune réponse HTTP :
 * Cloudflare coupe la connexion, timeout, reset TLS. Or `Response` rejette tout
 * status hors 200-599 → on ramène ce cas à 503 pour que le consommateur le
 * traite comme un échec géré (FaceitError → "blocked"), pas comme un throw.
 */
export function toResponseStatus(curlHttpCode: number): number {
  return curlHttpCode >= 200 && curlHttpCode <= 599 ? curlHttpCode : 503;
}

/**
 * fetch-compatible transport backed by the system curl (HTTP/1.1).
 * Node's TLS fingerprint (undici) is the most-blocked client on the
 * Cloudflare-guarded unofficial endpoints (0 pass measured), while plain curl
 * does pass when the scoring allows. curl ships with macOS, Linux and
 * Windows 10+; when unavailable we fall back to the global fetch.
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
