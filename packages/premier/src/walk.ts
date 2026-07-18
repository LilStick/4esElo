import { z } from "zod";

/**
 * Walk de l'historique de matchs Valve (MM/Premier) via l'API Steam officielle.
 * GetNextMatchSharingCode : (steamid + auth code + un share code connu) → share code suivant.
 * Forward-only : on ne remonte que vers les matchs plus récents que le code fourni.
 */

const NEXT_CODE_URL = "https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1";
const DICT = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export class PremierError extends Error {
  constructor(
    readonly status: number,
    message?: string,
  ) {
    super(message ?? `Premier walk ${status}`);
    this.name = "PremierError";
  }
}

/** Levée quand le known code a > 30j → Steam renvoie 412, il faut un code frais du joueur. */
export class ShareCodeExpiredError extends PremierError {
  constructor() {
    super(412, "share code de départ expiré (> 30j) - le joueur doit en fournir un récent");
    this.name = "ShareCodeExpiredError";
  }
}

export interface DecodedShareCode {
  matchId: bigint;
  reservationId: bigint;
  tvPort: number;
}

/** Décode `CSGO-xxxxx-...` → {matchId, reservationId, tvPort}. Pur, aucun réseau. */
export function decodeShareCode(code: string): DecodedShareCode {
  const clean = code.replace(/^CSGO-/, "").replace(/-/g, "");
  if (clean.length !== 25) throw new Error(`share code invalide: ${code}`);
  let big = 0n;
  for (const ch of [...clean].reverse()) {
    const idx = DICT.indexOf(ch);
    if (idx < 0) throw new Error(`caractère invalide dans le share code: ${ch}`);
    big = big * 57n + BigInt(idx);
  }
  const bytes = new Uint8Array(18);
  for (let i = 17; i >= 0; i--) {
    bytes[i] = Number(big & 0xffn);
    big >>= 8n;
  }
  const view = new DataView(bytes.buffer);
  return {
    matchId: view.getBigUint64(0, true),
    reservationId: view.getBigUint64(8, true),
    tvPort: view.getUint16(16, true),
  };
}

const nextCodeSchema = z.object({ result: z.object({ nextcode: z.string() }) });

export interface MatchWalker {
  /** Share code du match suivant après `knownCode` ; null = fin de l'historique. */
  nextShareCode(steamId64: string, authCode: string, knownCode: string): Promise<string | null>;
  /** Remonte tous les matchs postérieurs à `knownCode`, du plus ancien au plus récent. */
  walkFrom(
    steamId64: string,
    authCode: string,
    knownCode: string,
    opts?: { max?: number },
  ): Promise<string[]>;
}

export interface MatchWalkerOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Délai entre deux appels du walk (anti-429). */
  throttleMs?: number;
  /** Nb de retries sur 429 (backoff exponentiel 1s,2s,4s,8s). */
  maxRetries?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createMatchWalker(apiKey: string, opts: MatchWalkerOptions = {}): MatchWalker {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const throttleMs = opts.throttleMs ?? 1000;
  const maxRetries = opts.maxRetries ?? 4;

  async function nextShareCode(
    steamId64: string,
    authCode: string,
    knownCode: string,
  ): Promise<string | null> {
    const url =
      `${NEXT_CODE_URL}?key=${encodeURIComponent(apiKey)}` +
      `&steamid=${encodeURIComponent(steamId64)}` +
      `&steamidkey=${encodeURIComponent(authCode)}` +
      `&knowncode=${encodeURIComponent(knownCode)}`;
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(url);
      // 429 = rate-limit Steam (endpoint sensible aux bursts) → backoff + retry.
      if (res.status === 429 && attempt < maxRetries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (res.status === 202) return null; // pas de match plus récent
      if (res.status === 412) throw new ShareCodeExpiredError();
      if (!res.ok) throw new PremierError(res.status, `GetNextMatchSharingCode ${res.status}`);
      const parsed = nextCodeSchema.safeParse(await res.json());
      if (!parsed.success) throw new PremierError(200, "réponse GetNextMatchSharingCode inattendue");
      const next = parsed.data.result.nextcode;
      return next === "n/a" ? null : next;
    }
  }

  async function walkFrom(
    steamId64: string,
    authCode: string,
    knownCode: string,
    opts?: { max?: number },
  ): Promise<string[]> {
    const max = opts?.max ?? 1000;
    const codes: string[] = [];
    let cur = knownCode;
    for (let i = 0; i < max; i++) {
      if (i > 0) await sleep(throttleMs); // throttle : évite le burst qui déclenche le 429
      const next = await nextShareCode(steamId64, authCode, cur);
      if (!next) break;
      codes.push(next);
      cur = next;
    }
    return codes;
  }

  return { nextShareCode, walkFrom };
}
