import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Bzip2 from "seek-bzip";
import { parseTicks } from "@laihoe/demoparser2";
import type { PremierMatchResolver, PremierMatchResult } from "@4eselo/premier";
import type { GcBot } from "./gcBot";

/**
 * Résout un share code → CS Rating du membre après ce match (B18.3).
 * GC (bot) → URL démo → download → décompression bz2 → demoparser2.
 * Le rating vit dans la démo (`rank` avant, `rank_if_win|loss|tie` selon le résultat) ;
 * Compétitif (tiers 1-18) est écarté (rating Premier = milliers).
 */

const RANK_FIELDS = ["rank", "rank_if_win", "rank_if_loss", "rank_if_tie", "team_num", "team_rounds_total"];
const PREMIER_MIN_RATING = 1000; // en dessous = rang Compétitif (tier), pas du Premier

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
  if (!me || !me.rank || me.rank < PREMIER_MIN_RATING) return null; // pas Premier
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

export function createResolver(bot: GcBot, fetchImpl: typeof fetch = fetch): PremierMatchResolver {
  return {
    async resolve(steamId64: string, shareCode: string): Promise<PremierMatchResult | null> {
      const info = await bot.requestMatch(shareCode);
      if (!info.demoUrl) return null; // pas de démo (annulé)
      const res = await fetchImpl(info.demoUrl);
      if (!res.ok) return null; // 502 = démo expirée → irrésolvable
      const compressed = Buffer.from(await res.arrayBuffer());
      if (compressed.length < 1000) return null; // erreur déguisée en 200
      const dem = Bzip2.decode(compressed);
      const tmp = join(tmpdir(), `premier-${shareCode.replace(/[^A-Za-z0-9]/g, "")}.dem`);
      writeFileSync(tmp, dem);
      try {
        const rows = parseTicks(tmp, RANK_FIELDS) as unknown as DemoTickRow[];
        const computed = computeRatingAfter(rows, steamId64);
        if (!computed) return null;
        return { ratingAfter: computed.ratingAfter, playedAt: info.playedAt ?? new Date() };
      } finally {
        try {
          unlinkSync(tmp);
        } catch {
          // best-effort : le fichier temp sera nettoyé au reboot si la suppression échoue
        }
      }
    },
  };
}
