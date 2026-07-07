import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { announcements, db, eloSnapshots, players } from "@4eselo/db";
import type { DiscordOAuth } from "@4eselo/discord";
import type { Announcement, AnnouncementsResponse, FaceitMatchStats } from "@4eselo/types";
import { app } from "./app";
import { authDeps } from "./auth";

/** Intégration admin (B17.4) — Discord mocké, vraie DB, requireAdmin sur tout. */

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

const FAKE_CONFIG = {
  clientId: "cid",
  clientSecret: "csecret",
  redirectUri: "http://localhost:3001/auth/callback",
  guildId: "guild-4esport",
  guildInviteUrl: null,
  sessionSecret: "test-secret-0123456789-0123456789-abc",
  adminDiscordIds: ["iadmin-discord"],
};

function fakeOAuth(user: { id: string; displayName: string }): DiscordOAuth {
  return {
    authorizeUrl: (state) => `https://discord.test/authorize?state=${state}`,
    exchangeCode: async () => "fake-token",
    isGuildMember: async () => true,
    getUser: async () => ({ ...user, username: user.displayName, avatar: null }),
  };
}

async function sessionFor(discordId: string): Promise<string> {
  authDeps.oauth = fakeOAuth({ id: discordId, displayName: `User-${discordId}` });
  const login = await app.request("/auth/login");
  const stateCookie = login.headers.getSetCookie().map((c) => c.split(";")[0]!)[0]!;
  const state = new URL(login.headers.get("location")!).searchParams.get("state")!;
  const cb = await app.request(`/auth/callback?code=abc&state=${state}`, {
    headers: { cookie: stateCookie },
  });
  return cb.headers
    .getSetCookie()
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith("4eselo_session="))!;
}

const saved = { config: authDeps.config, oauth: authDeps.oauth };
let admin = "";
let member = "";

before(async () => {
  authDeps.config = FAKE_CONFIG;
  if (!DB_UP) return;
  admin = await sessionFor("iadmin-discord");
  member = await sessionFor("imember-discord");
});

after(async () => {
  authDeps.config = saved.config;
  authDeps.oauth = saved.oauth;
  if (DB_UP) await db.delete(announcements).where(eq(announcements.dedupeKey, "staff"));
});

const ZERO_STATS: FaceitMatchStats = {
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
};

const jsonReq = (method: string, path: string, cookie: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test("tout /admin/* refuse anonyme (401) et non-admin (403)", { skip }, async () => {
  const calls: [string, string, unknown?][] = [
    ["PATCH", "/admin/players/00000000-0000-0000-0000-000000000000", { formation: "x" }],
    ["DELETE", "/admin/players/00000000-0000-0000-0000-000000000000?confirm=true"],
    ["PUT", "/admin/announcement", { title: "x" }],
    ["DELETE", "/admin/announcement"],
    ["POST", "/admin/wrapped/2026/6/regenerate"],
  ];
  for (const [method, path, body] of calls) {
    assert.equal((await jsonReq(method, path, "", body)).status, 401, `${method} ${path} anonyme`);
    assert.equal((await jsonReq(method, path, member, body)).status, 403, `${method} ${path} membre`);
  }
});

test("PATCH /admin/players/:id : édition partielle, 404 inconnu, patch vide → 400", { skip }, async () => {
  const [p] = await db
    .insert(players)
    .values({ discordName: "iadm-edit", faceitNickname: "iadm_edit_nick", steamId64: "765_iadm_e" })
    .returning({ id: players.id });
  try {
    const res = await jsonReq("PATCH", `/admin/players/${p!.id}`, admin, {
      formation: "Licence",
      promoStart: 2024,
      promoEnd: 2027,
    });
    assert.equal(res.status, 200);
    const [row] = await db.select().from(players).where(eq(players.id, p!.id));
    assert.equal(row!.formation, "Licence");
    assert.equal(row!.promoEnd, 2027);
    assert.equal(row!.faceitNickname, "iadm_edit_nick"); // intouché

    const missing = await jsonReq("PATCH", "/admin/players/00000000-0000-0000-0000-000000000000", admin, {
      formation: "x",
    });
    assert.equal(missing.status, 404);
    assert.equal((await jsonReq("PATCH", `/admin/players/${p!.id}`, admin, {})).status, 400);
    assert.equal((await jsonReq("PATCH", `/admin/players/${p!.id}`, admin, { elo: 9999 })).status, 400); // champ inconnu
  } finally {
    await db.delete(players).where(eq(players.id, p!.id));
  }
});

test("DELETE /admin/players/:id : confirmation exigée, cascade sur l'historique", { skip }, async () => {
  const [p] = await db
    .insert(players)
    .values({ discordName: "iadm-del", faceitNickname: "iadm_del_nick", steamId64: "765_iadm_d" })
    .returning({ id: players.id });
  await db.insert(eloSnapshots).values({ playerId: p!.id, source: "faceit", elo: 1000, level: 3 });

  const noConfirm = await jsonReq("DELETE", `/admin/players/${p!.id}`, admin);
  assert.equal(noConfirm.status, 400);

  const res = await jsonReq("DELETE", `/admin/players/${p!.id}?confirm=true`, admin);
  assert.equal(res.status, 200);
  assert.equal((await db.select().from(players).where(eq(players.id, p!.id))).length, 0);
  const orphans = await db.select().from(eloSnapshots).where(eq(eloSnapshots.playerId, p!.id));
  assert.equal(orphans.length, 0); // cascade

  assert.equal((await jsonReq("DELETE", `/admin/players/${p!.id}?confirm=true`, admin)).status, 404);
});

test(
  "PUT /admin/announcement : upsert (1 seule active), servie publiquement, DELETE la retire",
  { skip },
  async () => {
    const first = await jsonReq("PUT", "/admin/announcement", admin, {
      title: "Tournoi interne samedi",
      body: "Inscrivez-vous avant vendredi soir !",
    });
    assert.equal(first.status, 200);

    const second = await jsonReq("PUT", "/admin/announcement", admin, { title: "Tournoi reporté" });
    assert.equal(second.status, 200);
    const updated = (await second.json()) as Announcement;
    assert.equal(updated.title, "Tournoi reporté");
    assert.equal(updated.body, null);

    const staffRows = await db.select().from(announcements).where(eq(announcements.type, "staff"));
    assert.equal(staffRows.length, 1); // upsert, pas d'empilement

    // lecture publique (sans session)
    const pub = (await (await app.request("/announcements")).json()) as AnnouncementsResponse;
    assert.ok(pub.announcements.some((a) => a.type === "staff" && a.title === "Tournoi reporté"));

    assert.equal((await jsonReq("DELETE", "/admin/announcement", admin)).status, 200);
    const after = await db.select().from(announcements).where(eq(announcements.type, "staff"));
    assert.equal(after.length, 0);

    assert.equal((await jsonReq("PUT", "/admin/announcement", admin, { title: "" })).status, 400);
  },
);

test(
  "POST /admin/wrapped/:y/:m/regenerate : mois vide → 409, mois réel → awards + annonce reposée",
  { skip },
  async () => {
    const empty = await jsonReq("POST", "/admin/wrapped/2021/5/regenerate", admin);
    assert.equal(empty.status, 409);

    // juin 2026 : les matchs seedés d'app.test.ts n'existent pas ici — on seed le nôtre
    const [p] = await db
      .insert(players)
      .values({ discordName: "iadm-wrap", faceitNickname: "iadm_wrap_nick", steamId64: "765_iadm_w" })
      .returning({ id: players.id });
    try {
      const { faceitMatchStats } = await import("@4eselo/db");
      await db.insert(faceitMatchStats).values(
        Array.from({ length: 5 }, (_, i) => ({
          matchId: `iadm-wrap-${i}`,
          playerId: p!.id,
          map: "de_mirage",
          playedAt: new Date(`2026-03-1${i}T20:00:00Z`),
          result: 1,
          stats: ZERO_STATS,
        })),
      );
      const res = await jsonReq("POST", "/admin/wrapped/2026/3/regenerate", admin);
      assert.equal(res.status, 200);

      const [ann] = await db
        .select()
        .from(announcements)
        .where(eq(announcements.dedupeKey, "wrapped-2026-03"));
      assert.ok(ann);
      assert.equal(ann!.linkUrl, "/wrapped/mars-2026");

      // relancer re-date sans dupliquer
      assert.equal((await jsonReq("POST", "/admin/wrapped/2026/3/regenerate", admin)).status, 200);
      const rows = await db
        .select()
        .from(announcements)
        .where(eq(announcements.dedupeKey, "wrapped-2026-03"));
      assert.equal(rows.length, 1);
    } finally {
      await db.delete(players).where(eq(players.id, p!.id));
      await db.delete(announcements).where(eq(announcements.dedupeKey, "wrapped-2026-03"));
    }
  },
);
