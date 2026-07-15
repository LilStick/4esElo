import "./env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql, eq } from "drizzle-orm";
import { db, players, eloSnapshots } from "@4eselo/db";
import { app } from "./app";
import { isCrawler, buildCardSvg, renderCrawlerHtml } from "./og";

// Intégration = vraie DB, skip propre si Postgres absent. Calculé AVANT tout
// test() (comme app.test.ts) : un await top-level intercalé entre des test()
// ferait sauter l'enregistrement de ceux déclarés après (node:test).
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

const UNKNOWN = "00000000-0000-0000-0000-000000000000";
let playerId = "";

before(async () => {
  if (!DB_UP) return;
  // Pas d'avatar Discord → aucun fetch réseau pendant les tests.
  const [p] = await db
    .insert(players)
    .values({ discordName: "og_itest", faceitNickname: "og_nick" })
    .returning({ id: players.id });
  playerId = p!.id;
  await db.insert(eloSnapshots).values({
    playerId,
    source: "faceit",
    elo: 1876,
    level: 8,
    capturedAt: new Date("2026-06-01T00:00:00Z"),
  });
});

after(async () => {
  if (!DB_UP || !playerId) return;
  await db.delete(players).where(eq(players.id, playerId)); // cascade → snapshots
});

// --- Unitaires (purs, aucune I/O) ---

test("isCrawler : Discord/Twitter/WhatsApp détectés, navigateur non, vide non", () => {
  assert.equal(isCrawler("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discord.com)"), true);
  assert.equal(isCrawler("Twitterbot/1.0"), true);
  assert.equal(isCrawler("WhatsApp/2.23"), true);
  assert.equal(isCrawler("Mozilla/5.0 (Macintosh) AppleWebKit Chrome/120 Safari"), false);
  assert.equal(isCrawler(undefined), false);
  assert.equal(isCrawler(null), false);
  assert.equal(isCrawler(""), false);
});

test("buildCardSvg : pseudo, ELO, niveau et stats présents", () => {
  const svg = buildCardSvg({
    nickname: "zowi-",
    level: 10,
    elo: 2644,
    avatarDataUri: null,
    stats: [
      { label: "Winrate", value: "58%" },
      { label: "K/D", value: "1.24" },
    ],
  });
  assert.match(svg, /width="1200" height="630"/);
  assert.match(svg, />zowi-</);
  assert.match(svg, />2644</);
  assert.match(svg, /Niveau 10/);
  assert.match(svg, />58%</);
  assert.match(svg, />Winrate</);
});

test("buildCardSvg : carte dégradée (pas de stats) + ELO inconnu quand null", () => {
  const svg = buildCardSvg({ nickname: "Bob", level: null, elo: null, avatarDataUri: null, stats: [] });
  assert.match(svg, /ELO inconnu/);
  assert.doesNotMatch(svg, /Winrate/);
  assert.doesNotMatch(svg, /Niveau/);
  // Pas d'avatar → initiale.
  assert.match(svg, />B</);
});

test("buildCardSvg : pseudo échappé (pas d'injection XML)", () => {
  const svg = buildCardSvg({
    nickname: '<script>&"x',
    level: null,
    elo: 1000,
    avatarDataUri: null,
    stats: [],
  });
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;&amp;&quot;x/);
});

test("renderCrawlerHtml : balises OG/Twitter par joueur, image absolue, échappement", () => {
  const html = renderCrawlerHtml({
    nickname: "zowi-",
    elo: 2644,
    level: 10,
    imageUrl: "https://api.example/players/abc/og.png",
    pageUrl: "https://example/player/abc",
  });
  assert.match(html, /<meta property="og:image" content="https:\/\/api\.example\/players\/abc\/og\.png" \/>/);
  assert.match(html, /<meta property="og:title" content="zowi- · 4esElo" \/>/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /2644 ELO · Niveau 10/);
});

// --- Intégration (vraie DB, skip si Postgres absent) ---

test("GET /players/:id/og.png → PNG", { skip }, async () => {
  const res = await app.request(`/players/${playerId}/og.png`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  const bytes = new Uint8Array(await res.arrayBuffer());
  // Signature PNG : 89 50 4E 47.
  assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.ok(bytes.length > 1000);
});

test("GET /players/:id/og.png : joueur inconnu → 404", { skip }, async () => {
  const res = await app.request(`/players/${UNKNOWN}/og.png`);
  assert.equal(res.status, 404);
});

test("GET /players/:id/og.png : id invalide → 400", { skip }, async () => {
  const res = await app.request(`/players/not-a-uuid/og.png`);
  assert.equal(res.status, 400);
});

test("GET /player/:id : crawler → HTML avec og:image du bon joueur", { skip }, async () => {
  const res = await app.request(`/player/${playerId}`, {
    headers: { "user-agent": "Discordbot/2.0" },
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  const html = await res.text();
  assert.match(html, new RegExp(`/players/${playerId}/og\\.png`));
  assert.match(html, /property="og:image"/);
});

test("GET /player/:id : navigateur normal → 302 vers la SPA", { skip }, async () => {
  const res = await app.request(`/player/${playerId}`, {
    headers: { "user-agent": "Mozilla/5.0 (Macintosh) Chrome/120 Safari" },
  });
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location") ?? "", new RegExp(`/player/${playerId}$`));
});

test("GET /player/:id : crawler + joueur inconnu → 404", { skip }, async () => {
  const res = await app.request(`/player/${UNKNOWN}`, {
    headers: { "user-agent": "Discordbot/2.0" },
  });
  assert.equal(res.status, 404);
});
