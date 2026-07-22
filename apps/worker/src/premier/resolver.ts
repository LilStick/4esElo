import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { PremierMatchResolver, PremierMatchResult } from "@4eselo/premier";
import type { GcBot } from "./gcBot";

/**
 * Résout un share code → CS Rating du membre après ce match (B18.3).
 * GC (bot) → URL démo, puis download+parse délégué à un PROCESS ENFANT : le parse
 * est synchrone et bloquerait l'event loop (→ le GC coupe la session). En l'isolant,
 * le worker reste réactif et le bot garde sa session GC pendant qu'on parse.
 */

const CHILD = fileURLToPath(new URL("./ratingChild.ts", import.meta.url));
const PARSE_TIMEOUT_MS = 180_000;

interface DemoRating {
  ratingAfter: number;
  result: "win" | "loss" | "tie";
}

/** Parse la démo dans un enfant `node --import tsx` → l'event loop du worker reste libre. */
function ratingViaChild(demoUrl: string, steamId64: string): Promise<DemoRating | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", CHILD, demoUrl, steamId64], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("timeout parse démo (180s)"));
    }, PARSE_TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || `parse exited ${code}`));
      try {
        resolve(JSON.parse(out || "null"));
      } catch (e) {
        reject(e as Error);
      }
    });
  });
}

export function createResolver(bot: GcBot): PremierMatchResolver {
  return {
    async resolve(steamId64: string, shareCode: string): Promise<PremierMatchResult | null> {
      // Erreur GC (session coupée, timeout) → propagée : le sync s'arrête et réessaie.
      const info = await bot.requestMatch(shareCode);
      if (!info.demoUrl) {
        console.log(`[premier] ${shareCode}: pas de démo (annulé/indispo) → ignoré`);
        return null;
      }
      let rating: DemoRating | null;
      try {
        rating = await ratingViaChild(info.demoUrl, steamId64);
      } catch (e) {
        // Échec de parse (démo corrompue, timeout) : on saute CE match, pas tout le sync.
        console.log(
          `[premier] ${shareCode}: parse démo échoué (${e instanceof Error ? e.message : e}) → ignoré`,
        );
        return null;
      }
      if (!rating) {
        console.log(`[premier] ${shareCode}: démo illisible (expirée / pas Premier) → ignoré`);
        return null;
      }
      console.log(`[premier] ${shareCode}: rating=${rating.ratingAfter}`);
      return { ratingAfter: rating.ratingAfter, playedAt: info.playedAt ?? new Date() };
    },
  };
}
