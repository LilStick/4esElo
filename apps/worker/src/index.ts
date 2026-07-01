import "./env";
import { db, players } from "@4eselo/db";
import { isNotNull } from "drizzle-orm";
import { FaceitClient } from "@4eselo/faceit";
import { syncPlayer, type PlayerToSync } from "./sync";
import { dbStore } from "./store";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 10 * 60 * 1000);
const DELAY_BETWEEN_PLAYERS_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function runOnce(faceit: FaceitClient): Promise<void> {
  const rows = await db
    .select({ id: players.id, faceitId: players.faceitId })
    .from(players)
    .where(isNotNull(players.faceitId));

  const toSync: PlayerToSync[] = shuffle(rows).map((r) => ({
    id: r.id,
    faceitId: r.faceitId as string,
  }));

  console.log(`[worker] syncing ${toSync.length} player(s)`);
  for (const p of toSync) {
    try {
      const res = await syncPlayer(faceit, dbStore, p);
      const suffix = "elo" in res ? ` (elo=${res.elo})` : "";
      console.log(`[worker] ${p.faceitId}: ${res.status}${suffix}`);
    } catch (err) {
      console.error(`[worker] ${p.faceitId} failed:`, err instanceof Error ? err.message : err);
    }
    await sleep(DELAY_BETWEEN_PLAYERS_MS);
  }
}

async function main() {
  const key = process.env.FACEIT_API_KEY;
  if (!key) throw new Error("FACEIT_API_KEY is not set");
  const faceit = new FaceitClient(key);

  if (process.argv.includes("--once")) {
    await runOnce(faceit);
    process.exit(0);
  }

  console.log(`[worker] starting loop, every ${Math.round(INTERVAL_MS / 1000)}s`);
  while (true) {
    await runOnce(faceit).catch((err) => console.error("[worker] run failed:", err));
    await sleep(INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
