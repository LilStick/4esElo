import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { parseTicks } from "@laihoe/demoparser2";

// seek-bzip n'a pas de types → require typé inline (marche cross-package sans shim).
const Bzip2: { decode(buf: Buffer): Buffer } = createRequire(import.meta.url)("seek-bzip");

/**
 * Extraction du CS Rating depuis une démo Premier (B18.3). I/O isolée dans le
 * package provider (download + décompression bz2 + parse demoparser2).
 * Le rating vit dans la démo : `rank` (avant) + `rank_if_win|loss|tie` (selon le
 * résultat). Compétitif (tiers 1-18) est écarté (rating Premier = milliers).
 */

const RANK_FIELDS = ["rank", "rank_if_win", "rank_if_loss", "rank_if_tie", "team_num", "team_rounds_total"];
const PREMIER_MIN_RATING = 1000;

export interface DemoTickRow {
  steamid: string;
  tick: number;
  rank: number;
  rank_if_win: number;
  rank_if_loss: number;
  rank_if_tie: number;
  team_num: number;
  team_rounds_total: number;
}

/** Rating du membre après le match, ou null si ce n'est pas du Premier. Pur, testable. */
export function computeRatingAfter(
  rows: DemoTickRow[],
  steamId64: string,
): { ratingAfter: number; result: "win" | "loss" | "tie" } | null {
  const lastByPlayer = new Map<string, DemoTickRow>();
  for (const r of [...rows].sort((a, b) => a.tick - b.tick)) lastByPlayer.set(String(r.steamid), r);
  const me = lastByPlayer.get(steamId64);
  if (!me || !me.rank || me.rank < PREMIER_MIN_RATING) return null;
  const oppScore = Math.max(
    0,
    ...[...lastByPlayer.values()]
      .filter((r) => r.team_num !== me.team_num)
      .map((r) => r.team_rounds_total ?? 0),
  );
  const myScore = me.team_rounds_total ?? 0;
  const result = myScore > oppScore ? "win" : myScore < oppScore ? "loss" : "tie";
  const ratingAfter =
    result === "win" ? me.rank_if_win : result === "loss" ? me.rank_if_loss : me.rank_if_tie;
  return { ratingAfter, result };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Download de la démo, avec retry sur erreur réseau. Les gros fichiers Valve
 * coupent souvent en cours (`fetch failed` = ECONNRESET/socket) → sans retry on
 * perdait des matchs. Un vrai statut d'erreur HTTP (404/502 = démo expirée) n'est
 * PAS retenté. null = démo indisponible ; throw = réseau KO après tous les essais.
 */
export async function downloadDemo(
  demoUrl: string,
  fetchImpl: typeof fetch = fetch,
  opts: { retries?: number; backoffMs?: number } = {},
): Promise<Buffer | null> {
  const retries = opts.retries ?? 3;
  const backoffMs = opts.backoffMs ?? 500;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchImpl(demoUrl);
      if (!res.ok) return null; // 404/502 = démo expirée → inutile de retenter
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length < 1000 ? null : buf; // 200 vide = erreur déguisée
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(backoffMs * 2 ** attempt);
    }
  }
}

/** Télécharge + parse une démo → CS Rating du membre après le match. null = irrésolvable (démo expirée, pas Premier). */
export async function ratingFromDemo(
  demoUrl: string,
  steamId64: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ratingAfter: number; result: "win" | "loss" | "tie" } | null> {
  const compressed = await downloadDemo(demoUrl, fetchImpl);
  if (!compressed) return null;
  const dem = Bzip2.decode(compressed);
  const tmp = join(tmpdir(), `premier-${randomUUID()}.dem`);
  writeFileSync(tmp, dem);
  try {
    const rows = parseTicks(tmp, RANK_FIELDS) as unknown as DemoTickRow[];
    return computeRatingAfter(rows, steamId64);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // best-effort : nettoyé au reboot si la suppression échoue
    }
  }
}
