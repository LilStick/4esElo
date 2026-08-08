import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, inArray } from "drizzle-orm";
import { db, players, eloSnapshots } from "@4eselo/db";
import type { LeaderboardResponse, PlayerDetail } from "@4eselo/types";
import { app } from "./app";
import { premierDeps } from "./premier";

// Intégration = vraie DB, skip propre si Postgres absent.
async function dbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
const DB_UP = await dbReachable();
const skip = DB_UP ? false : "requires Postgres - run `pnpm db:up`";

let rankedId = "";
let placementId = "";

before(async () => {
  premierDeps.enabled = true; // le gate B18.21 ferme source=premier flag off ; ici on teste la surface Premier
  if (!DB_UP) return;
  const [ranked] = await db
    .insert(players)
    .values({ discordName: "ranked_itest", faceitNickname: "ranked_nick", faceitUnranked: false })
    .returning({ id: players.id });
  const [placement] = await db
    .insert(players)
    .values({ discordName: "placement_itest", faceitNickname: "placement_nick", faceitUnranked: true })
    .returning({ id: players.id });
  rankedId = ranked!.id;
  placementId = placement!.id;
  // Le classé a un point de courbe ; le joueur en placement n'en a aucun (ELO caché).
  await db.insert(eloSnapshots).values({ playerId: rankedId, source: "faceit", elo: 1800, level: 8 });
});

after(async () => {
  if (!DB_UP || !rankedId) return;
  await db.delete(players).where(inArray(players.id, [rankedId, placementId])); // cascade → snapshots
});

test("/leaderboard expose unranked (placement vs classé)", { skip }, async () => {
  const res = await app.request("/leaderboard?source=faceit");
  assert.equal(res.status, 200);
  const body = (await res.json()) as LeaderboardResponse;
  const byId = new Map(body.leaderboard.map((e) => [e.id, e]));
  assert.equal(byId.get(placementId)?.unranked, true);
  assert.equal(byId.get(placementId)?.elo, null); // ELO caché en placement
  assert.equal(byId.get(rankedId)?.unranked, false);
});

test("/players/:id expose unranked", { skip }, async () => {
  const inPlacement = (await (
    await app.request(`/players/${placementId}?source=faceit`)
  ).json()) as PlayerDetail;
  assert.equal(inPlacement.unranked, true);
  const classe = (await (await app.request(`/players/${rankedId}?source=faceit`)).json()) as PlayerDetail;
  assert.equal(classe.unranked, false);
});

test("placement = notion FACEIT : unranked toujours false pour premier", { skip }, async () => {
  const body = (await (await app.request("/leaderboard?source=premier")).json()) as LeaderboardResponse;
  const entry = body.leaderboard.find((e) => e.id === placementId);
  assert.equal(entry?.unranked, false);
});
