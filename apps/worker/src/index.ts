import { FACEIT_API_KEY, STEAM_API_KEY, WORKER_INTERVAL_MS } from "./env";
import { db, players } from "@4eselo/db";
import { isNotNull } from "drizzle-orm";
import { FaceitClient, UnofficialEloHistory } from "@4eselo/faceit";
import { SteamClient } from "@4eselo/steam";
import { syncPlayer, type PlayerToSync } from "./sync";
import { ingestPlayerMatches } from "./ingest";
import { ingestMatches } from "./ingestMatches";
import { attributeEloAfter } from "./eloAfter";
import { samplePlaytime } from "./playtime";
import { backfillPlayerElo } from "./backfillElo";
import { announceWrapped } from "./announceWrapped";
import { curlFetch } from "./curlFetch";
import {
  dbStore,
  dbMatchStatsStore,
  dbMatchStore,
  dbPlaytimeStore,
  dbBackfillStore,
  dbAnnouncementStore,
} from "./store";

// curl transport: Node's TLS fingerprint never passes the Cloudflare wall,
// plain curl sometimes does — that's the whole opportunistic bet.
const eloHistory = new UnofficialEloHistory({ fetchImpl: curlFetch() });

const INTERVAL_MS = WORKER_INTERVAL_MS;
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
  try {
    const ann = await announceWrapped(dbAnnouncementStore, dbAnnouncementStore);
    if (ann.status === "posted") {
      console.log(`[worker] wrapped ${ann.year}-${ann.month} annoncé sur le site 🎁`);
    } else if (ann.status === "empty-month") {
      console.log(`[worker] wrapped ${ann.year}-${ann.month}: aucun match ce mois-là, pas d'annonce`);
    }
  } catch (err) {
    console.error("[worker] wrapped announce failed:", err instanceof Error ? err.message : err);
  }

  if (STEAM_API_KEY) {
    try {
      const withSteam = await db
        .select({ id: players.id, steamId64: players.steamId64 })
        .from(players)
        .where(isNotNull(players.steamId64));
      const steam = new SteamClient({ apiKey: STEAM_API_KEY });
      const pt = await samplePlaytime(
        steam,
        dbPlaytimeStore,
        withSteam.map((r) => ({ id: r.id, steamId64: r.steamId64 as string })),
      );
      if (pt.sampled > 0 || pt.failed > 0) {
        console.log(`[worker] playtime: +${pt.sampled} (privés ${pt.failed}, déjà fait ${pt.skipped})`);
      }
    } catch (err) {
      console.error("[worker] playtime failed:", err instanceof Error ? err.message : err);
    }
  }

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
    let syncRes = null;
    try {
      syncRes = await syncPlayer(faceit, dbStore, p);
      const suffix = "elo" in syncRes ? ` (elo=${syncRes.elo})` : "";
      console.log(`[worker] ${p.faceitId}: ${syncRes.status}${suffix}`);
    } catch (err) {
      console.error(`[worker] ${p.faceitId} failed:`, err instanceof Error ? err.message : err);
    }
    try {
      const ing = await ingestPlayerMatches(faceit, dbMatchStatsStore, p);
      if (ing.inserted > 0 || ing.failed > 0) {
        console.log(
          `[worker] ${p.faceitId}: matches +${ing.inserted} (skipped ${ing.skipped}, failed ${ing.failed})`,
        );
      }
      const attr = syncRes && attributeEloAfter(syncRes, ing);
      if (attr) {
        await dbMatchStatsStore.setEloAfter(p.id, attr.matchId, attr.elo);
        console.log(`[worker] ${p.faceitId}: eloAfter=${attr.elo} → ${attr.matchId}`);
      }
    } catch (err) {
      console.error(`[worker] ${p.faceitId} ingest failed:`, err instanceof Error ? err.message : err);
    }
    try {
      const bf = await backfillPlayerElo(eloHistory, dbBackfillStore, p);
      if (bf.status === "ok") {
        console.log(
          `[worker] ${p.faceitId}: backfill 🎉 ${bf.matchesFilled} matchs remplis, ${bf.snapshotsInserted} points de courbe rétro`,
        );
      } else if (bf.status === "blocked") {
        console.log(`[worker] ${p.faceitId}: backfill 403 — on repassera demain`);
      }
    } catch (err) {
      console.error(`[worker] ${p.faceitId} backfill failed:`, err instanceof Error ? err.message : err);
    }
    await sleep(DELAY_BETWEEN_PLAYERS_MS);
  }

  // Vue match-level (B4.3) : remplit `matches` (nouveaux + backfill des anciens)
  // après la passe joueurs, une fois par run.
  try {
    const mi = await ingestMatches(faceit, dbMatchStore);
    if (mi.inserted > 0 || mi.failed > 0) {
      console.log(`[worker] matches +${mi.inserted} (scanné ${mi.scanned}, échec ${mi.failed})`);
    }
  } catch (err) {
    console.error("[worker] match-level ingest failed:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  if (!FACEIT_API_KEY) throw new Error("FACEIT_API_KEY is not set");
  const faceit = new FaceitClient(FACEIT_API_KEY);

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
