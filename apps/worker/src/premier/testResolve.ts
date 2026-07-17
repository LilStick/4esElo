import { STEAM_BOT_USERNAME, STEAM_BOT_PASSWORD, STEAM_BOT_SHARED_SECRET } from "../env";
import { createGcBot } from "./gcBot";
import { createResolver } from "./resolver";

/**
 * CLI de test end-to-end du resolver (B18.3) :
 *   pnpm --filter @4eselo/worker premier:resolve <steamId64> <shareCode>
 * Bot GC → URL démo → download → parse → CS Rating du joueur après le match.
 */

const [steamId64, shareCode] = process.argv.slice(2);
if (!steamId64 || !shareCode) {
  console.error("usage: premier:resolve <steamId64> <shareCode>");
  process.exit(1);
}
if (!STEAM_BOT_USERNAME || !STEAM_BOT_PASSWORD || !STEAM_BOT_SHARED_SECRET) {
  console.error("Manque STEAM_BOT_USERNAME / STEAM_BOT_PASSWORD / STEAM_BOT_SHARED_SECRET dans .env");
  process.exit(1);
}

const bot = createGcBot({
  username: STEAM_BOT_USERNAME,
  password: STEAM_BOT_PASSWORD,
  sharedSecret: STEAM_BOT_SHARED_SECRET,
});
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
