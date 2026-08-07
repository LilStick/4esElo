import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { db, players, eloSnapshots, faceitMatchStats } from "@4eselo/db";
import type {
  FaceitMatchStats,
  SeasonsResponse,
  EloCurveResponse,
  MatchesResponse,
  PlayerStatsResponse,
} from "@4eselo/types";
import { app } from "./app";
import { listSeasons, seasonRange, parseSeason } from "./seasons";

/** B19.2 — modèle de saison (dérivé des dates) + filtre `?season=`. */

// DB d'abord (top-level await) → tous les test() sont déclarés APRÈS, sinon
// --test-force-exit coupe avant les tests déclarés post-await.
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

function makeStats(over: Partial<FaceitMatchStats> = {}): FaceitMatchStats {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    kd: 0,
    kr: 0,
    adr: 0,
    damage: 0,
    hsPercent: 0,
    mvps: 0,
    doubleKills: 0,
    tripleKills: 0,
    quadroKills: 0,
    pentaKills: 0,
    clutch1v1Count: 0,
    clutch1v1Wins: 0,
    clutch1v2Count: 0,
    clutch1v2Wins: 0,
    clutchKills: 0,
    entryCount: 0,
    entryWins: 0,
    firstKills: 0,
    utilityDamage: 0,
    utilityCount: 0,
    flashCount: 0,
    enemiesFlashed: 0,
    flashSuccesses: 0,
    sniperKills: 0,
    ...over,
  };
}

// Un point/match AVANT S8 (saison précédente) et un APRÈS (dans S8).
const PRE = new Date("2026-03-01T00:00:00Z"); // < 2026-04-22 → hors S8
const POST = new Date("2026-05-01T00:00:00Z"); // ≥ 2026-04-22 → dans S8
let pid = "";

before(async () => {
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({ discordName: "iseason", faceitNickname: "iseason", faceitId: "f-iseason" })
    .returning({ id: players.id });
  pid = p!.id;
  await db.insert(eloSnapshots).values([
    { playerId: pid, source: "faceit", elo: 1400, level: 7, capturedAt: PRE },
    { playerId: pid, source: "faceit", elo: 1500, level: 7, capturedAt: POST },
  ]);
  await db.insert(faceitMatchStats).values([
    { matchId: "m-pre", playerId: pid, map: "de_dust2", playedAt: PRE, result: 1, stats: makeStats() },
    { matchId: "m-post", playerId: pid, map: "de_mirage", playedAt: POST, result: 1, stats: makeStats() },
  ]);
});

after(async () => {
  if (DB_UP && pid) await db.delete(players).where(eq(players.id, pid)); // cascade
});

const json = async <T>(path: string): Promise<T> => (await app.request(path)).json() as Promise<T>;

// --- Unit (pur) ------------------------------------------------------------

test("listSeasons : S8 exposée, saison courante (endsAt null)", () => {
  const s8 = listSeasons().find((s) => s.id === "S8");
  assert.ok(s8, "S8 doit être listée");
  assert.equal(s8!.startsAt, "2026-04-22T00:00:00.000Z");
  assert.equal(s8!.endsAt, null); // dernière saison connue = courante
});

test("seasonRange : bornes de S8 ; id inconnu → null", () => {
  const r = seasonRange("S8");
  assert.ok(r);
  assert.equal(r!.start.toISOString(), "2026-04-22T00:00:00.000Z");
  assert.equal(r!.end, null);
  assert.equal(seasonRange("S99"), null);
});

test("parseSeason : absent → pas de filtre ; connu → range ; inconnu → ok:false", () => {
  assert.deepEqual(parseSeason(undefined), { ok: true, range: null });
  const ok = parseSeason("S8");
  assert.ok(ok.ok && ok.range);
  assert.equal(parseSeason("nope").ok, false);
});

// --- Intégration (vraie DB, skip si Postgres absent) -----------------------

test("GET /seasons expose la liste", { skip }, async () => {
  const body = await json<SeasonsResponse>("/seasons");
  assert.ok(body.seasons.some((s) => s.id === "S8"));
});

test("courbe ELO : ?season=S8 ne garde que les points de la saison", { skip }, async () => {
  const all = await json<EloCurveResponse>(`/players/${pid}/elo`);
  assert.equal(all.points.length, 2); // sans filtre = tout
  const s8 = await json<EloCurveResponse>(`/players/${pid}/elo?season=S8`);
  assert.equal(s8.points.length, 1);
  assert.equal(s8.points[0]!.elo, 1500); // le point POST uniquement
});

test("matchs : ?season=S8 ne garde que les matchs de la saison", { skip }, async () => {
  const all = await json<MatchesResponse>(`/players/${pid}/matches`);
  assert.equal(all.total, 2);
  const s8 = await json<MatchesResponse>(`/players/${pid}/matches?season=S8`);
  assert.equal(s8.total, 1);
  assert.equal(s8.items[0]!.matchId, "m-post");
});

test("stats : ?season=S8 borne l'agrégat à la saison", { skip }, async () => {
  const all = await json<PlayerStatsResponse>(`/players/${pid}/stats`);
  assert.equal(all.overall.matches, 2);
  const s8 = await json<PlayerStatsResponse>(`/players/${pid}/stats?season=S8`);
  assert.equal(s8.overall.matches, 1);
});

test("saison inconnue → 400", { skip }, async () => {
  assert.equal((await app.request(`/players/${pid}/elo?season=NOPE`)).status, 400);
  assert.equal((await app.request(`/players/${pid}/matches?season=NOPE`)).status, 400);
  assert.equal((await app.request(`/players/${pid}/stats?season=NOPE`)).status, 400);
});
