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
  PlayerDetail,
} from "@4eselo/types";
import { app } from "./app";
import {
  listSeasons,
  seasonRange,
  parseSeason,
  deriveSeasons,
  deriveSeasonRange,
  seasonConds,
} from "./seasons";

/** B19.2 — modèle de saison (dérivé des dates) + filtre `?season=`. B19.3 — durcissement. */

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

// PRE = hors S8 (saison précédente) ; S8A/S8B = dans S8, tous > 7 jours avant aujourd'hui.
const PRE = new Date("2026-03-01T00:00:00Z"); // < 2026-04-22
const S8A = new Date("2026-05-01T00:00:00Z"); // ≥ 2026-04-22, >7j
const S8B = new Date("2026-05-02T00:00:00Z");
let pid = ""; // joueur avec historique
let emptyPid = ""; // joueur sans aucun snapshot (placement/nouvel inscrit)

before(async () => {
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({ discordName: "iseason", faceitNickname: "iseason", faceitId: "f-iseason" })
    .returning({ id: players.id });
  pid = p!.id;
  const [e] = await db
    .insert(players)
    .values({ discordName: "iempty", faceitNickname: "iempty", faceitId: "f-iempty" })
    .returning({ id: players.id });
  emptyPid = e!.id;

  await db.insert(eloSnapshots).values([
    { playerId: pid, source: "faceit", elo: 1400, level: 7, capturedAt: PRE },
    { playerId: pid, source: "faceit", elo: 1500, level: 7, capturedAt: S8A },
  ]);
  // eloAfter posés → permet de vérifier que la fenêtre ±ELO est bornée à la saison.
  await db.insert(faceitMatchStats).values([
    {
      matchId: "m-pre",
      playerId: pid,
      map: "de_dust2",
      playedAt: PRE,
      result: 1,
      eloAfter: 1000,
      stats: makeStats(),
    },
    {
      matchId: "m-s8a",
      playerId: pid,
      map: "de_mirage",
      playedAt: S8A,
      result: 1,
      eloAfter: 1099,
      stats: makeStats(),
    },
    {
      matchId: "m-s8b",
      playerId: pid,
      map: "de_nuke",
      playedAt: S8B,
      result: 1,
      eloAfter: 1120,
      stats: makeStats(),
    },
  ]);
});

after(async () => {
  if (DB_UP && pid) await db.delete(players).where(eq(players.id, pid)); // cascade
  if (DB_UP && emptyPid) await db.delete(players).where(eq(players.id, emptyPid));
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

test("dérivation [start, end) sur 2 saisons synthétiques (endsAt = début de la suivante)", () => {
  const STARTS = [
    { id: "A", label: "A", startsAt: "2026-01-01T00:00:00.000Z" },
    { id: "B", label: "B", startsAt: "2026-06-01T00:00:00.000Z" },
  ];
  const seasons = deriveSeasons(STARTS);
  assert.equal(seasons[0]!.endsAt, "2026-06-01T00:00:00.000Z"); // fin de A = début de B
  assert.equal(seasons[1]!.endsAt, null); // B = courante

  const a = deriveSeasonRange(STARTS, "A")!;
  assert.equal(a.start.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(a.end!.toISOString(), "2026-06-01T00:00:00.000Z"); // borne haute présente
  assert.equal(deriveSeasonRange(STARTS, "B")!.end, null);
});

test("seasonConds : borne haute seulement si end non-null (le lt() est bien branché)", () => {
  const courante = seasonConds(faceitMatchStats.playedAt, {
    id: "S8",
    start: new Date("2026-04-22T00:00:00Z"),
    end: null,
  });
  assert.equal(courante.length, 1); // gte seul
  const close = seasonConds(faceitMatchStats.playedAt, {
    id: "A",
    start: new Date("2026-01-01T00:00:00Z"),
    end: new Date("2026-06-01T00:00:00Z"),
  });
  assert.equal(close.length, 2); // gte + lt
  assert.equal(seasonConds(faceitMatchStats.playedAt, null).length, 0); // pas de filtre
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
  assert.equal(s8.points[0]!.elo, 1500); // le point S8 uniquement
});

test("matchs : ?season=S8 filtre + le ±ELO ne traverse plus le reset", { skip }, async () => {
  const all = await json<MatchesResponse>(`/players/${pid}/matches`);
  assert.equal(all.total, 3);
  // Sans filtre : le 1er match S8 dérive à travers le reset (1099 − 1000 = 99, artefact).
  assert.equal(all.items.find((m) => m.matchId === "m-s8a")!.eloDelta, 99);

  const s8 = await json<MatchesResponse>(`/players/${pid}/matches?season=S8`);
  assert.equal(s8.total, 2);
  // Avec filtre : la fenêtre lag() est bornée à S8 → le plus ancien match S8 n'hérite
  // PAS du relevé pré-reset → ±ELO null (pas de faux saut).
  assert.equal(s8.items.find((m) => m.matchId === "m-s8a")!.eloDelta, null);
  assert.equal(s8.items.find((m) => m.matchId === "m-s8b")!.eloDelta, 21); // 1120 − 1099
});

test("stats : la saison prime sur la fenêtre roulante (?season=S8&range=7d)", { skip }, async () => {
  // Les 2 matchs S8 datent de mai (>7j) : range=7d seul → 0 ; season=S8 → comptés malgré range.
  const rolling = await json<PlayerStatsResponse>(`/players/${pid}/stats?range=7d`);
  assert.equal(rolling.overall.matches, 0);
  const s8 = await json<PlayerStatsResponse>(`/players/${pid}/stats?season=S8&range=7d`);
  assert.equal(s8.overall.matches, 2); // la saison l'emporte
});

test(
  "profil : membre en placement (aucun snapshot) → elo/level null, history vide, pas de crash",
  { skip },
  async () => {
    const res = await app.request(`/players/${emptyPid}`);
    assert.equal(res.status, 200);
    const detail = (await res.json()) as PlayerDetail;
    assert.equal(detail.elo, null);
    assert.equal(detail.level, null);
    assert.deepEqual(detail.history, []);
  },
);

test("saison inconnue → 400", { skip }, async () => {
  assert.equal((await app.request(`/players/${pid}/elo?season=NOPE`)).status, 400);
  assert.equal((await app.request(`/players/${pid}/matches?season=NOPE`)).status, 400);
  assert.equal((await app.request(`/players/${pid}/stats?season=NOPE`)).status, 400);
});
