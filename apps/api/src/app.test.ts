import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { db, players, eloSnapshots, faceitMatchStats, playtimeSnapshots } from "@4eselo/db";
import type {
  ActivityResponse,
  AnnouncementsResponse,
  DuosResponse,
  PlayerDuosResponse,
  PlayerDetail,
  EloCurveResponse,
  LeaderboardResponse,
  MatchesResponse,
  FaceitMatchStats,
  MoversResponse,
  PlayerStatsResponse,
  PlayerWrappedResponse,
} from "@4eselo/types";
import { app } from "./app";

/** All-zero stats, overridable per test — matches the FaceitMatchStats shape. */
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

// Integration tests hit a real Postgres. Skip cleanly if it isn't reachable
// (e.g. someone ran `pnpm test` without `pnpm db:up`).
async function dbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
const DB_UP = await dbReachable();
const skip = DB_UP ? false : "requires Postgres — run `pnpm db:up`";

let playerId = "";
let moverId = "";
const HOUR = 60 * 60 * 1000;

before(async () => {
  if (!DB_UP) return;
  const [p] = await db
    .insert(players)
    .values({
      discordName: "itest",
      faceitNickname: "itest_nick",
      steamId64: "765_itest",
      discordAvatar: "itest_avatar_hash",
      formation: "Mastère Dev",
      promoStart: 2026,
      promoEnd: 2028,
    })
    .returning({ id: players.id });
  playerId = p!.id;
  const [m] = await db
    .insert(players)
    .values({ discordName: "imover", faceitNickname: "imover_nick", steamId64: "765_imover" })
    .returning({ id: players.id });
  moverId = m!.id;
  await db.insert(eloSnapshots).values([
    // tracked since 3 days: baseline exists for 24h, not for 7d
    {
      playerId: moverId,
      source: "faceit",
      elo: 1500,
      level: 6,
      capturedAt: new Date(Date.now() - 72 * HOUR),
    },
    { playerId: moverId, source: "faceit", elo: 1560, level: 6, capturedAt: new Date(Date.now() - 2 * HOUR) },
  ]);
  await db.insert(eloSnapshots).values([
    { playerId, source: "faceit", elo: 1000, level: 3, capturedAt: new Date("2026-01-01T00:00:00Z") },
    { playerId, source: "faceit", elo: 1100, level: 4, capturedAt: new Date("2026-01-02T00:00:00Z") },
  ]);
  await db.insert(faceitMatchStats).values([
    {
      matchId: "it-m1",
      playerId,
      map: "de_mirage",
      playedAt: new Date("2026-06-01T20:00:00Z"),
      result: 1,
      eloAfter: 1050,
      stats: makeStats({ kills: 20, deaths: 10, adr: 90 }),
    },
    {
      matchId: "it-m2",
      playerId,
      map: "de_dust2",
      playedAt: new Date("2026-06-02T20:00:00Z"),
      result: 0,
      eloAfter: null,
      stats: makeStats({ kills: 10, deaths: 20, adr: 60 }),
    },
    {
      matchId: "it-m3",
      playerId,
      map: "de_mirage",
      playedAt: new Date("2026-06-03T20:00:00Z"),
      result: 1,
      eloAfter: 1080,
      stats: makeStats({ kills: 30, deaths: 15, adr: 110 }),
    },
  ]);
});

after(async () => {
  if (!DB_UP || !playerId) return;
  await db.delete(players).where(eq(players.id, playerId)); // cascade removes snapshots
  await db.delete(players).where(eq(players.id, moverId));
});

test("GET /players/:id returns profile, latest elo and chronological history", { skip }, async () => {
  const res = await app.request(`/players/${playerId}`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as PlayerDetail;

  assert.equal(body.faceitNickname, "itest_nick");
  assert.equal(body.elo, 1100); // latest snapshot wins
  assert.equal(body.level, 4);
  assert.equal(body.history.length, 2);
  assert.equal(body.history[0]!.elo, 1000); // oldest first
  assert.equal(body.history[1]!.elo, 1100);
  assert.equal(body.playtimePrivate, null); // jamais échantillonné
});

test("GET /players/:id flags private playtime from the last snapshot", { skip }, async () => {
  await db.insert(playtimeSnapshots).values({ playerId, minutesForever: null });
  const res = await app.request(`/players/${playerId}`);
  const body = (await res.json()) as PlayerDetail;
  assert.equal(body.playtimePrivate, true);
  await db.delete(playtimeSnapshots).where(eq(playtimeSnapshots.playerId, playerId));
});

test("GET /players/:id returns 404 for an unknown id", { skip }, async () => {
  const res = await app.request(`/players/00000000-0000-0000-0000-000000000000`);
  assert.equal(res.status, 404);
});

test("GET /players/:id/elo returns the curve points for the source", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/elo?source=faceit`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as EloCurveResponse;
  assert.equal(body.source, "faceit");
  assert.equal(body.points.length, 2);
});

test("GET /players/:id/elo is empty for a source with no snapshots", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/elo?source=premier`);
  const body = await res.json();
  assert.deepEqual(body, { source: "premier", points: [] });
});

test("GET /players/:id/matches lists stored matches, newest first, with total", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/matches`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as MatchesResponse;

  assert.equal(body.total, 3);
  assert.deepEqual(
    body.items.map((m) => m.matchId),
    ["it-m3", "it-m2", "it-m1"],
  );
  const top = body.items[0]!;
  assert.equal(top.map, "de_mirage");
  assert.equal(top.result, 1);
  assert.equal(top.eloAfter, 1080);
  assert.equal(top.stats.kills, 30);
  assert.equal(top.playedAt, "2026-06-03T20:00:00.000Z");
});

test("GET /players/:id/matches paginates with limit/offset (total unchanged)", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/matches?limit=1&offset=1`);
  const body = (await res.json()) as MatchesResponse;

  assert.equal(body.total, 3);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0]!.matchId, "it-m2");
});

test("GET /players/:id/matches returns 404 for an unknown player", { skip }, async () => {
  const res = await app.request(`/players/00000000-0000-0000-0000-000000000000/matches`);
  assert.equal(res.status, 404);
});

test("GET /players/:id/matches rejects an invalid limit with 400", { skip }, async () => {
  for (const q of ["limit=abc", "limit=0", "limit=999", "offset=-1"]) {
    const res = await app.request(`/players/${playerId}/matches?${q}`);
    assert.equal(res.status, 400, q);
  }
});

test("GET /players/:id/stats aggregates stored matches (default range=all)", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/stats`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as PlayerStatsResponse;

  assert.equal(body.range, "all");
  assert.equal(body.overall.matches, 3);
  assert.equal(body.overall.wins, 2);
  assert.equal(body.overall.winRate, 66.7);
  assert.equal(body.overall.kd, 1.3); // 60 kills / 45 deaths
  const mirage = body.maps.find((m) => m.map === "de_mirage");
  assert.ok(mirage);
  assert.equal(mirage.matches, 2);
  assert.equal(mirage.winRate, 100);
});

test("GET /players/:id/stats?range=7d excludes matches older than the window", { skip }, async () => {
  // seeded matches are dated 2026-06-01..03 → outside a 7d window from now
  const res = await app.request(`/players/${playerId}/stats?range=7d`);
  const body = (await res.json()) as PlayerStatsResponse;

  assert.equal(body.range, "7d");
  assert.equal(body.overall.matches, 0);
  assert.equal(body.overall.winRate, 0);
  assert.deepEqual(body.maps, []);
});

test("GET /players/:id/stats rejects an unknown range with 400", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/stats?range=1y`);
  assert.equal(res.status, 400);
});

test("GET /players/:id/stats returns 404 for an unknown player", { skip }, async () => {
  const res = await app.request(`/players/00000000-0000-0000-0000-000000000000/stats`);
  assert.equal(res.status, 404);
});

test("GET /leaderboard/movers?window=24h computes deltas vs the window baseline", { skip }, async () => {
  const res = await app.request(`/leaderboard/movers?window=24h`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as MoversResponse;

  const mover = body.movers.find((m) => m.id === moverId);
  const stable = body.movers.find((m) => m.id === playerId);
  assert.ok(mover && stable);
  assert.equal(mover.delta, 60); // 1560 now vs 1500 before the window
  assert.equal(stable.delta, 0); // old snapshots on both sides → unchanged
  assert.ok(body.movers.indexOf(mover) < body.movers.indexOf(stable)); // biggest gain first
});

test(
  "GET /leaderboard/movers?window=7d gives null delta when not tracked at window start",
  { skip },
  async () => {
    const res = await app.request(`/leaderboard/movers?window=7d`);
    const body = (await res.json()) as MoversResponse;

    const mover = body.movers.find((m) => m.id === moverId);
    const stable = body.movers.find((m) => m.id === playerId);
    assert.equal(mover!.delta, null); // first snapshot is 3 days old
    assert.equal(stable!.delta, 0);
    assert.ok(body.movers.indexOf(mover!) > body.movers.indexOf(stable!)); // nulls last
  },
);

test("B17.6: leaderboard, movers and player detail expose promo + avatar", { skip }, async () => {
  // itest is registered (avatar + formation + promo), imover is not → nulls.
  const lb = (await (await app.request(`/leaderboard`)).json()) as LeaderboardResponse;
  const registered = lb.leaderboard.find((e) => e.id === playerId);
  const bare = lb.leaderboard.find((e) => e.id === moverId);
  assert.equal(registered!.discordAvatar, "itest_avatar_hash");
  assert.equal(registered!.formation, "Mastère Dev");
  assert.equal(registered!.promoStart, 2026);
  assert.equal(registered!.promoEnd, 2028);
  assert.equal(bare!.discordAvatar, null);
  assert.equal(bare!.formation, null);
  assert.equal(bare!.promoStart, null);

  const mv = (await (await app.request(`/leaderboard/movers`)).json()) as MoversResponse;
  const mvRegistered = mv.movers.find((e) => e.id === playerId);
  assert.equal(mvRegistered!.formation, "Mastère Dev");
  assert.equal(mvRegistered!.discordAvatar, "itest_avatar_hash");

  const detail = (await (await app.request(`/players/${playerId}`)).json()) as PlayerDetail;
  assert.equal(detail.discordAvatar, "itest_avatar_hash");
  assert.equal(detail.formation, "Mastère Dev");
  assert.equal(detail.promoStart, 2026);
  assert.equal(detail.promoEnd, 2028);
});

test("GET /leaderboard/movers rejects an unknown window with 400", { skip }, async () => {
  const res = await app.request(`/leaderboard/movers?window=1y`);
  assert.equal(res.status, 400);
});

test("GET /leaderboard?sparkline=N attaches the last N points, oldest first", { skip }, async () => {
  const res = await app.request(`/leaderboard?sparkline=2`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as LeaderboardResponse;

  const mover = body.leaderboard.find((e) => e.id === moverId);
  assert.deepEqual(mover!.sparkline, [1500, 1560]);
  const noSpark = await app.request(`/leaderboard`);
  const plain = (await noSpark.json()) as LeaderboardResponse;
  assert.equal(plain.leaderboard[0]!.sparkline, undefined);
});

test("GET /leaderboard rejects an invalid sparkline with 400", { skip }, async () => {
  for (const q of ["sparkline=0", "sparkline=999", "sparkline=abc"]) {
    const res = await app.request(`/leaderboard?${q}`);
    assert.equal(res.status, 400, q);
  }
});

test(
  "B11.4: /leaderboard sorts by ELO desc, latest snapshot wins, no-snapshot players last",
  { skip },
  async () => {
    // ghost: no snapshot at all → elo null, ranked last
    const [g] = await db
      .insert(players)
      .values({ faceitNickname: "ighost_nick", steamId64: "765_ighost" })
      .returning({ id: players.id });
    try {
      const res = await app.request(`/leaderboard`);
      assert.equal(res.status, 200);
      const { leaderboard } = (await res.json()) as LeaderboardResponse;

      const ours = leaderboard.filter((e) =>
        ["itest_nick", "imover_nick", "ighost_nick"].includes(e.faceitNickname ?? ""),
      );
      // mover (1560, latest of its two snapshots) > itest (1100, latest wins over 1000) > ghost (null)
      assert.deepEqual(
        ours.map((e) => [e.faceitNickname, e.elo]),
        [
          ["imover_nick", 1560],
          ["itest_nick", 1100],
          ["ighost_nick", null],
        ],
      );
      // ranks strictly increasing in that order, ghost after everyone with an elo
      assert.ok(ours[0]!.rank < ours[1]!.rank && ours[1]!.rank < ours[2]!.rank);
      const lastWithElo = Math.max(...leaderboard.filter((e) => e.elo !== null).map((e) => e.rank));
      assert.ok(ours[2]!.rank > lastWithElo);
    } finally {
      await db.delete(players).where(eq(players.id, g!.id));
    }
  },
);

test("B11.4: /leaderboard?source=premier has no snapshots → every elo null", { skip }, async () => {
  const res = await app.request(`/leaderboard?source=premier`);
  const { source, leaderboard } = (await res.json()) as LeaderboardResponse;
  assert.equal(source, "premier");
  assert.ok(leaderboard.length >= 2);
  assert.ok(leaderboard.every((e) => e.elo === null));
});

test("B11.1: invalid ?source= rejected with 400 everywhere", { skip }, async () => {
  for (const path of [
    `/leaderboard?source=csgo`,
    `/leaderboard/movers?source=csgo`,
    `/players/${playerId}?source=csgo`,
    `/players/${playerId}/elo?source=csgo`,
  ]) {
    const res = await app.request(path);
    assert.equal(res.status, 400, path);
  }
});

test("B11.1: non-UUID :id rejected with 400 on every player route", { skip }, async () => {
  for (const path of [
    `/players/hackerman`,
    `/players/hackerman/elo`,
    `/players/hackerman/matches`,
    `/players/hackerman/stats`,
  ]) {
    const res = await app.request(path);
    assert.equal(res.status, 400, path);
  }
});

test("B7.2: GET /wrapped on an empty month → 200 with no awards", { skip }, async () => {
  // 2021-05 : bien avant toute donnée (le backfill le plus profond remonte à mai 2024)
  const res = await app.request(`/wrapped/2021/5`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { year: 2021, month: 5, awards: [] });
});

test("B7.2: GET /wrapped rejects an invalid year/month with 400", { skip }, async () => {
  for (const path of [`/wrapped/2026/13`, `/wrapped/1999/1`, `/wrapped/abc/1`, `/wrapped/2026/0`]) {
    const res = await app.request(path);
    assert.equal(res.status, 400, path);
  }
});

test("B7.2: GET /wrapped/:y/:m/:playerId returns the player month summary", { skip }, async () => {
  // juin 2026 : les 3 matchs seedés (it-m1..3) appartiennent à ce joueur
  const res = await app.request(`/wrapped/2026/6/${playerId}`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as PlayerWrappedResponse;

  assert.equal(body.matches, 3);
  assert.equal(body.wins, 2);
  assert.equal(body.winRate, 66.7);
  assert.deepEqual(body.topMap, { map: "de_mirage", matches: 2, winRate: 100 });
  assert.equal(body.elo, null); // ses snapshots datent de janvier, pas de juin
  assert.equal(body.playtimeMinutes, null);
  // les percentiles dépendent des autres joueurs actifs du mois (données réelles) → bornes seulement
  assert.ok(body.percentiles);
  for (const v of Object.values(body.percentiles)) assert.ok(v >= 0 && v <= 100);
});

test("B7.2: GET /wrapped/:y/:m/:playerId on a month without games → percentiles null", { skip }, async () => {
  const res = await app.request(`/wrapped/2021/5/${playerId}`);
  const body = (await res.json()) as PlayerWrappedResponse;
  assert.equal(body.matches, 0);
  assert.equal(body.topMap, null);
  assert.equal(body.percentiles, null);
  assert.deepEqual(body.awards, []);
});

test("B7.2: GET /wrapped/:y/:m/:playerId → 404 unknown player, 400 bad uuid", { skip }, async () => {
  const missing = await app.request(`/wrapped/2026/6/00000000-0000-0000-0000-000000000000`);
  assert.equal(missing.status, 404);
  const bad = await app.request(`/wrapped/2026/6/hackerman`);
  assert.equal(bad.status, 400);
});

test("B5.2: /players/:id/activity counts per UTC day, sparse, window applied", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/activity`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as ActivityResponse;
  assert.equal(body.days, 365);
  // ses 3 matchs seedés (01, 02, 03 juin) — un jour = une entrée, rien d'autre
  assert.deepEqual(body.activity, [
    { day: "2026-06-01", matches: 1 },
    { day: "2026-06-02", matches: 1 },
    { day: "2026-06-03", matches: 1 },
  ]);

  // fenêtre 1 jour = aujourd'hui seulement → ses matchs de juin sortent de la fenêtre
  const today = await app.request(`/players/${playerId}/activity?days=1`);
  const todayBody = (await today.json()) as ActivityResponse;
  assert.deepEqual(todayBody.activity, []);
});

test("B5.2: /activity counts a shared match once (distinct matchId)", { skip }, async () => {
  const day = "2026-06-20";
  const before = (await (await app.request(`/activity`)).json()) as ActivityResponse;
  const countBefore = before.activity.find((d) => d.day === day)?.matches ?? 0;

  const duo = await db
    .insert(players)
    .values([
      { discordName: "iactA", faceitNickname: "iactA_nick", steamId64: "765_iactA" },
      { discordName: "iactB", faceitNickname: "iactB_nick", steamId64: "765_iactB" },
    ])
    .returning({ id: players.id });
  try {
    await db.insert(faceitMatchStats).values(
      duo.map(({ id }) => ({
        matchId: "it-act-shared",
        playerId: id,
        map: "de_nuke",
        playedAt: new Date(`${day}T21:00:00Z`),
        result: 1,
        stats: makeStats(),
      })),
    );
    const after = (await (await app.request(`/activity`)).json()) as ActivityResponse;
    const countAfter = after.activity.find((d) => d.day === day)?.matches ?? 0;
    // 2 lignes (2 membres) mais 1 seul match → +1, pas +2
    assert.equal(countAfter, countBefore + 1);
  } finally {
    for (const { id } of duo) await db.delete(players).where(eq(players.id, id));
  }
});

test("B5.2: /activity rejects an invalid days, player routes validated", { skip }, async () => {
  for (const q of ["days=0", "days=9999", "days=abc"]) {
    const res = await app.request(`/activity?${q}`);
    assert.equal(res.status, 400, q);
  }
  const missing = await app.request(`/players/00000000-0000-0000-0000-000000000000/activity`);
  assert.equal(missing.status, 404);
  const bad = await app.request(`/players/hackerman/activity`);
  assert.equal(bad.status, 400);
});

test("B4.1: /social/duos and /players/:id/duos expose seeded teammates", { skip }, async () => {
  const duo = await db
    .insert(players)
    .values([
      { discordName: "iduoA", faceitNickname: "iduoA_nick", steamId64: "765_iduoA" },
      { discordName: "iduoB", faceitNickname: "iduoB_nick", steamId64: "765_iduoB" },
    ])
    .returning({ id: players.id });
  const [a, b] = [duo[0]!.id, duo[1]!.id];
  try {
    // 5 games ensemble (4 wins), même matchId + même résultat = coéquipiers
    const results = [1, 1, 1, 1, 0];
    await db.insert(faceitMatchStats).values(
      results.flatMap((result, i) =>
        [a, b].map((playerId) => ({
          matchId: `it-duo-${i}`,
          playerId,
          map: "de_mirage",
          playedAt: new Date(`2026-06-1${i}T20:00:00Z`),
          result,
          stats: makeStats(),
        })),
      ),
    );

    const res = await app.request(`/social/duos`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as DuosResponse;
    assert.equal(body.minMatches, 5);
    const ours = body.duos.find((d) => d.players.some((p) => p.id === a));
    assert.ok(ours, "seeded duo should be listed");
    assert.deepEqual(
      ours.players.map((p) => p.nickname),
      ["iduoA_nick", "iduoB_nick"],
    );
    assert.equal(ours.matches, 5);
    assert.equal(ours.winRate, 80);

    const mine = await app.request(`/players/${a}/duos`);
    assert.equal(mine.status, 200);
    const mineBody = (await mine.json()) as PlayerDuosResponse;
    assert.equal(mineBody.playerId, a);
    assert.ok(mineBody.duos.every((d) => d.players.some((p) => p.id === a)));
    assert.equal(mineBody.duos.length, 1);
  } finally {
    await db.delete(players).where(eq(players.id, a)); // cascade sur ses matchs
    await db.delete(players).where(eq(players.id, b));
  }
});

test("B4.1: /players/:id/duos → vide sans match commun, 404 inconnu, 400 uuid", { skip }, async () => {
  // itest ne partage aucun matchId avec un autre membre → aucun duo
  const res = await app.request(`/players/${playerId}/duos`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as PlayerDuosResponse;
  assert.deepEqual(body.duos, []);

  const missing = await app.request(`/players/00000000-0000-0000-0000-000000000000/duos`);
  assert.equal(missing.status, 404);
  const bad = await app.request(`/players/hackerman/duos`);
  assert.equal(bad.status, 400);
});

test("B7.4: GET /announcements lists newest first, honors limit, rejects bad limit", { skip }, async () => {
  const { announcements } = await import("@4eselo/db");
  const inserted = await db
    .insert(announcements)
    .values([
      {
        type: "wrapped",
        title: "Le Wrapped de mai est là 🎁",
        linkUrl: "/wrapped/mai-2026",
        dedupeKey: "itest-wrapped-2026-05",
        publishedAt: new Date("2026-06-01T00:00:00Z"),
      },
      {
        type: "wrapped",
        title: "Le Wrapped de juin est là 🎁",
        linkUrl: "/wrapped/juin-2026",
        dedupeKey: "itest-wrapped-2026-06",
        publishedAt: new Date("2026-07-01T00:00:00Z"),
      },
    ])
    .returning({ id: announcements.id });
  try {
    const res = await app.request(`/announcements`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as AnnouncementsResponse;
    const ours = body.announcements.filter((a) => a.title.startsWith("Le Wrapped de"));
    assert.ok(ours.length >= 2);
    // plus récent d'abord
    assert.ok(
      body.announcements.findIndex((a) => a.linkUrl === "/wrapped/juin-2026") <
        body.announcements.findIndex((a) => a.linkUrl === "/wrapped/mai-2026"),
    );

    const limited = await app.request(`/announcements?limit=1`);
    const one = (await limited.json()) as AnnouncementsResponse;
    assert.equal(one.announcements.length, 1);

    for (const q of ["limit=0", "limit=999", "limit=abc"]) {
      const bad = await app.request(`/announcements?${q}`);
      assert.equal(bad.status, 400, q);
    }
  } finally {
    for (const { id } of inserted) {
      await db.delete(announcements).where(eq(announcements.id, id));
    }
  }
});

test("B11.1: /health reports the DB state", { skip }, async () => {
  const res = await app.request(`/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, db: true });
});

test("B11.1: CORS allows the configured front origin only", { skip }, async () => {
  const allowed = await app.request(`/health`, { headers: { Origin: "http://localhost:5173" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const denied = await app.request(`/health`, { headers: { Origin: "https://evil.example" } });
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});
