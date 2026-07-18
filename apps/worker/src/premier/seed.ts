import "../env"; // charge .env (DATABASE_URL) avant @4eselo/db
import { and, eq, or } from "drizzle-orm";
import { db, players, eloSnapshots } from "@4eselo/db";

/**
 * Seed de dev : pose une courbe Premier factice pour un joueur, afin de coder le
 * front V2 bi-source sans faire tourner le bot.
 *   pnpm --filter @4eselo/worker premier:seed <faceitNickname|steamId64> [count]
 */

const ident = process.argv[2];
const count = Number(process.argv[3]) || 8;
if (!ident) {
  console.error("usage: premier:seed <faceitNickname|steamId64> [count]");
  process.exit(1);
}

const [p] = await db
  .select({ id: players.id, nick: players.faceitNickname })
  .from(players)
  .where(or(eq(players.faceitNickname, ident), eq(players.steamId64, ident)))
  .limit(1);
if (!p) {
  console.error(`aucun joueur pour "${ident}"`);
  process.exit(1);
}

// rejouable : on repart de zéro pour la source premier de ce joueur.
await db.delete(eloSnapshots).where(and(eq(eloSnapshots.playerId, p.id), eq(eloSnapshots.source, "premier")));

const now = Date.now();
const values = Array.from({ length: count }, (_, i) => ({
  playerId: p.id,
  source: "premier" as const,
  elo: 14000 + i * 80 + (i % 3) * 60 - (i % 2) * 40,
  capturedAt: new Date(now - (count - 1 - i) * 24 * 60 * 60 * 1000),
}));
await db.insert(eloSnapshots).values(values);
console.log(
  `✅ ${count} snapshots premier seedés pour ${p.nick ?? ident} (${values[0]!.elo} → ${values[values.length - 1]!.elo})`,
);
process.exit(0);
