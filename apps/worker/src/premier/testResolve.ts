import { config } from "dotenv";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGcBot } from "./gcBot";
import { createResolver } from "./resolver";

// Charge le .env racine.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: pathResolve(here, "../../../../.env") });

/**
 * CLI de test end-to-end du resolver (B18.3) :
 *   tsx src/premier/testResolve.ts <steamId64> <shareCode>
 * Bot GC → URL démo → download → parse → CS Rating du joueur après le match.
 */

const [steamId64, shareCode] = process.argv.slice(2);
if (!steamId64 || !shareCode) {
  console.error("usage: tsx src/premier/testResolve.ts <steamId64> <shareCode>");
  process.exit(1);
}

const username = process.env.STEAM_BOT_USERNAME;
const password = process.env.STEAM_BOT_PASSWORD;
const sharedSecret = process.env.STEAM_BOT_SHARED_SECRET;
if (!username || !password || !sharedSecret) {
  console.error("Manque STEAM_BOT_USERNAME / STEAM_BOT_PASSWORD / STEAM_BOT_SHARED_SECRET dans .env");
  process.exit(1);
}

const bot = createGcBot({ username, password, sharedSecret });
console.log("[..] connexion au GC…");
await bot.ready();
console.log("[ok] GC prêt, résolution du match…");
const resolver = createResolver(bot);
const r = await resolver.resolve(steamId64, shareCode);
console.log(
  "\nRÉSULTAT:",
  r
    ? `CS Rating après match = ${r.ratingAfter}  (joué le ${r.playedAt.toISOString()})`
    : "irrésolvable (pas Premier / démo expirée / joueur absent)",
);
bot.shutdown();
process.exit(0);
