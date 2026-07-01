import "./env";
import { eq } from "drizzle-orm";
import { db, players } from "@4eselo/db";
import { FaceitClient, FaceitError, FaceitNotFoundError } from "@4eselo/faceit";

/**
 * One-shot manual registration until the Discord bot exists (phase 2).
 *   pnpm --filter @4eselo/worker add-player <faceitNickname> [discordName]
 */
async function main() {
  const nickname = process.argv[2];
  const discordName = process.argv[3] ?? null;
  if (!nickname) {
    console.error("usage: add-player <faceitNickname> [discordName]");
    process.exit(1);
  }

  const key = process.env.FACEIT_API_KEY;
  if (!key) throw new Error("FACEIT_API_KEY is not set");
  const faceit = new FaceitClient(key);

  const player = await faceit.getPlayerByNickname(nickname);
  if (!player.cs2) {
    console.error(`"${player.nickname}" has no CS2 profile on Faceit.`);
    process.exit(1);
  }

  const existing = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.faceitId, player.playerId));

  if (existing.length > 0) {
    console.log(`Already registered: ${player.nickname} (faceitId=${player.playerId})`);
    process.exit(0);
  }

  await db.insert(players).values({
    faceitId: player.playerId,
    faceitNickname: player.nickname,
    steamId64: player.cs2.steamId64,
    discordName,
  });

  console.log(
    `Registered ${player.nickname} — elo=${player.cs2.elo}, level=${player.cs2.skillLevel}, steam=${player.cs2.steamId64}`,
  );
  process.exit(0);
}

main().catch((err) => {
  if (err instanceof FaceitNotFoundError) {
    console.error(`Nickname not found on Faceit. (The API key itself works — auth passed.)`);
  } else if (err instanceof FaceitError) {
    console.error(
      `Faceit API error ${err.status}. If 401/403, the API key is wrong or not a server-side key.`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
