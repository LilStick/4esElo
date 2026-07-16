/**
 * Cartes de partage OG par joueur (B5.4) : un lien de profil dans Discord affiche
 * la carte du joueur au lieu de l'aperçu générique.
 *  - GET /players/:id/og.png : PNG rendu via resvg (pas de navigateur headless).
 *  - GET /player/:id : crawlers (détectés par User-Agent) → HTML OG ; navigateur → SPA.
 * Rendu/détection = purs ; l'I/O (DB, fetch avatar) vit dans les handlers.
 */
import { Hono } from "hono";
import { Resvg } from "@resvg/resvg-js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, desc, eq } from "drizzle-orm";
import { db, players, eloSnapshots, faceitMatchStats } from "@4eselo/db";
import { fetchAvatarDataUri } from "@4eselo/discord";
import { computeAggregate, type MatchForStats } from "./stats";
import { WEB_ORIGINS } from "./env";
import { badRequest, readPlayerId, uuidSchema } from "./http";

export const ogRoutes = new Hono();

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Police embarquée → rendu déterministe (pas de polices système).
const here = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = resolve(here, "../assets/fonts/Inter-variable.ttf");

const COLORS = {
  bg: "#060709",
  surface: "#11141b",
  ink: "#f4f6fa",
  inkDim: "#8b90a0",
  inkFaint: "#565b6e",
  brand: "#5e8bff",
  brandHi: "#86a6ff",
} as const;

// Crawlers d'aperçu : eux seuls reçoivent le HTML OG, le reste → SPA.
const CRAWLER_RE =
  /(bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|embedly|pinterest|redditbot|applebot|vkshare|skypeuripreview|iframely|preview)/i;

export function isCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && CRAWLER_RE.test(userAgent);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export interface OgCardData {
  nickname: string;
  level: number | null;
  elo: number | null;
  /** Data URI, ou null → initiale sur pastille. */
  avatarDataUri: string | null;
  /** 0-3 stats ; vide = carte dégradée. */
  stats: { label: string; value: string }[];
}

export function buildCardSvg(data: OgCardData): string {
  const name = escapeXml(truncate(data.nickname, 16));
  const initial = escapeXml((data.nickname.trim()[0] ?? "?").toUpperCase());
  const cx = 190;
  const cy = 300;
  const r = 130;
  const col = 380; // colonne texte à droite de l'avatar

  const avatar = data.avatarDataUri
    ? `<clipPath id="clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
       <image href="${data.avatarDataUri}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#clip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${COLORS.surface}"/>
       <text x="${cx}" y="${cy}" font-size="140" font-weight="800" fill="${COLORS.brandHi}" text-anchor="middle" dominant-baseline="central">${initial}</text>`;

  const levelBadge =
    data.level !== null
      ? `<g transform="translate(${col}, 168)">
           <rect width="216" height="54" rx="27" fill="${COLORS.surface}" stroke="${COLORS.brand}" stroke-opacity="0.5"/>
           <text x="30" y="36" font-size="30" font-weight="600" fill="${COLORS.brandHi}">Niveau ${data.level}</text>
         </g>`
      : "";

  const eloText =
    data.elo !== null
      ? `<text x="${col}" y="380" font-size="130" font-weight="800" fill="${COLORS.ink}">${data.elo}<tspan font-size="48" font-weight="600" fill="${COLORS.inkDim}" dx="18">ELO</tspan></text>`
      : `<text x="${col}" y="360" font-size="72" font-weight="700" fill="${COLORS.inkDim}">ELO inconnu</text>`;

  // Rangée de stats : valeur au-dessus du label.
  const statCols = data.stats
    .map((s, i) => {
      const x = col + i * 268;
      return `<g transform="translate(${x}, 508)">
        <text x="0" y="0" font-size="62" font-weight="800" fill="${COLORS.brandHi}">${escapeXml(s.value)}</text>
        <text x="0" y="44" font-size="30" font-weight="500" fill="${COLORS.inkDim}">${escapeXml(s.label)}</text>
      </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" font-family="Inter">
  <defs>
    <radialGradient id="glow" cx="85%" cy="0%" r="80%">
      <stop offset="0" stop-color="${COLORS.brand}" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="${COLORS.brand}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${COLORS.bg}"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="${COLORS.brand}" stroke-opacity="0.6" stroke-width="4"/>
  ${avatar}
  <text x="${col}" y="128" font-size="76" font-weight="800" fill="${COLORS.ink}">${name}</text>
  ${levelBadge}
  ${eloText}
  ${statCols}
  <text x="${col}" y="596" font-size="30" font-weight="600" fill="${COLORS.inkFaint}">4esElo · Classement CS2 du pôle</text>
</svg>`;
}

export function renderCardPng(svg: string): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
    font: { fontFiles: [FONT_PATH], defaultFontFamily: "Inter", loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

export interface CrawlerHtmlData {
  nickname: string;
  elo: number | null;
  level: number | null;
  imageUrl: string;
  pageUrl: string;
}

export function renderCrawlerHtml(d: CrawlerHtmlData): string {
  const title = `${escapeXml(d.nickname)} · 4esElo`;
  const bits = [d.elo !== null ? `${d.elo} ELO` : null, d.level !== null ? `Niveau ${d.level}` : null].filter(
    Boolean,
  );
  const description = escapeXml(
    bits.length > 0 ? `${bits.join(" · ")} - sur le classement CS2 du pôle` : "Sur le classement CS2 du pôle",
  );
  const img = escapeXml(d.imageUrl);
  const url = escapeXml(d.pageUrl);
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="4esElo" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${img}" />
  </head>
  <body>
    <a href="${url}">${title}</a>
  </body>
</html>`;
}

/** Carte depuis la DB (source faceit) ; null si joueur inconnu. */
async function loadCardData(id: string): Promise<OgCardData | null> {
  const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  if (!player) return null;

  const [latest] = await db
    .select({ elo: eloSnapshots.elo, level: eloSnapshots.level })
    .from(eloSnapshots)
    .where(and(eq(eloSnapshots.playerId, id), eq(eloSnapshots.source, "faceit")))
    .orderBy(desc(eloSnapshots.capturedAt))
    .limit(1);

  const matchRows = await db
    .select({ map: faceitMatchStats.map, result: faceitMatchStats.result, stats: faceitMatchStats.stats })
    .from(faceitMatchStats)
    .where(eq(faceitMatchStats.playerId, id));

  const nickname = player.faceitNickname ?? player.discordName ?? "Joueur";
  const avatarDataUri =
    player.discordId && player.discordAvatar
      ? await fetchAvatarDataUri(player.discordId, player.discordAvatar)
      : null;

  // Carte dégradée (pseudo + ELO) si aucun match.
  let stats: OgCardData["stats"] = [];
  if (matchRows.length > 0) {
    const agg = computeAggregate("all", matchRows as MatchForStats[]);
    stats = [
      { label: "Winrate", value: `${agg.winRate}%` },
      { label: "K/D", value: agg.kd.toFixed(2) },
      { label: "Rating", value: agg.rating !== null ? agg.rating.toFixed(2) : "-" },
    ];
  }

  return { nickname, level: latest?.level ?? null, elo: latest?.elo ?? null, avatarDataUri, stats };
}

ogRoutes.get("/players/:id/og.png", async (c) => {
  const id = readPlayerId(c);
  if (!id) return badRequest(c, "invalid player id (uuid)");
  const data = await loadCardData(id);
  if (!data) return c.json({ error: "player not found" }, 404);

  const png = renderCardPng(buildCardSvg(data));
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
});

ogRoutes.get("/player/:id", async (c) => {
  const id = c.req.param("id");
  // Humains → SPA ; carte réservée aux crawlers.
  if (!isCrawler(c.req.header("user-agent"))) {
    return c.redirect(`${WEB_ORIGINS[0]}/player/${id}`, 302);
  }
  if (!uuidSchema.safeParse(id).success) return c.notFound();

  const data = await loadCardData(id);
  if (!data) return c.notFound();

  const origin = new URL(c.req.url).origin;
  const html = renderCrawlerHtml({
    nickname: data.nickname,
    elo: data.elo,
    level: data.level,
    imageUrl: `${origin}/players/${id}/og.png`,
    pageUrl: `${WEB_ORIGINS[0]}/player/${id}`,
  });
  return c.html(html);
});
