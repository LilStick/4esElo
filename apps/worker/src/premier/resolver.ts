import { ratingFromDemo } from "@4eselo/premier";
import type { PremierMatchResolver, PremierMatchResult } from "@4eselo/premier";
import type { GcBot } from "./gcBot";

/**
 * Résout un share code → CS Rating du membre après ce match (B18.3).
 * GC (bot) → URL démo, puis download+parse délégué au provider (@4eselo/premier).
 */
export function createResolver(bot: GcBot, fetchImpl?: typeof fetch): PremierMatchResolver {
  return {
    async resolve(steamId64: string, shareCode: string): Promise<PremierMatchResult | null> {
      const info = await bot.requestMatch(shareCode);
      if (!info.demoUrl) return null; // pas de démo (annulé, etc.)
      const rating = await ratingFromDemo(info.demoUrl, steamId64, fetchImpl);
      if (!rating) return null;
      return { ratingAfter: rating.ratingAfter, playedAt: info.playedAt ?? new Date() };
    },
  };
}
