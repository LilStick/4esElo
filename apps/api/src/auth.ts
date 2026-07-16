import { Hono, type Context, type MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, players } from "@4eselo/db";
import { DiscordOAuthClient, type DiscordOAuth } from "@4eselo/discord";
import type { MeResponse } from "@4eselo/types";
import { AUTH_CONFIG, WEB_ORIGINS, type AuthConfig } from "./env";
import { isBanned } from "./banCache";

/**
 * Auth Discord (B17.1) : OAuth → cookie httpOnly signé (HMAC), 7 j. Pas de table
 * sessions : le cookie porte tout, révocation = expiration. Provider injectable
 * (tests sans réseau).
 */

const SESSION_COOKIE = "4eselo_session";
const STATE_COOKIE = "4eselo_oauth_state";
const SESSION_TTL_S = 7 * 24 * 60 * 60;

export interface SessionPayload {
  discordId: string;
  displayName: string;
  /** Hash avatar, null si aucun (absent sur vieux cookies → null). */
  avatar?: string | null;
  exp: number; // epoch seconds
}

/** Injectable pour les tests (cf. presenceDeps). */
export const authDeps: { config: AuthConfig | null; oauth: DiscordOAuth | null } = {
  config: AUTH_CONFIG,
  oauth: AUTH_CONFIG
    ? new DiscordOAuthClient({
        clientId: AUTH_CONFIG.clientId,
        clientSecret: AUTH_CONFIG.clientSecret,
        redirectUri: AUTH_CONFIG.redirectUri,
      })
    : null,
};

/** Retour après le flow : 1re origine CORS = le front. */
const webHome = () => WEB_ORIGINS[0] ?? "http://localhost:5173";

const secure = () => webHome().startsWith("https://");

export async function readSession(c: Context): Promise<SessionPayload | null> {
  const { config } = authDeps;
  if (!config) return null;
  const raw = await getSignedCookie(c, config.sessionSecret, SESSION_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionPayload;
    if (typeof parsed.discordId !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    // Ban (B17.9) : coupe une session valide déjà ouverte.
    if (await isBanned(parsed.discordId)) return null;
    return parsed;
  } catch {
    return null; // cookie corrompu → anonyme, pas une 500
  }
}

async function writeSession(c: Context, payload: Omit<SessionPayload, "exp">): Promise<void> {
  const { config } = authDeps;
  if (!config) return;
  const session: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S };
  await setSignedCookie(c, SESSION_COOKIE, JSON.stringify(session), config.sessionSecret, {
    httpOnly: true,
    sameSite: "Lax",
    secure: secure(),
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

/** Admin = socle env ADMIN_DISCORD_IDS (non-retirable) OU flag is_admin en base (B12.10). */
export async function isAdmin(discordId: string): Promise<boolean> {
  if (authDeps.config?.adminDiscordIds.includes(discordId)) return true;
  const [p] = await db
    .select({ isAdmin: players.isAdmin })
    .from(players)
    .where(eq(players.discordId, discordId))
    .limit(1);
  return p?.isAdmin ?? false;
}

const notConfigured = (c: Context) => c.json({ error: "auth not configured" }, 503);

export const authRoutes = new Hono();

authRoutes.get("/auth/login", async (c) => {
  const { config, oauth } = authDeps;
  if (!config || !oauth) return notConfigured(c);
  const state = randomBytes(16).toString("hex");
  await setSignedCookie(c, STATE_COOKIE, state, config.sessionSecret, {
    httpOnly: true,
    sameSite: "Lax",
    secure: secure(),
    path: "/",
    maxAge: 10 * 60,
  });
  return c.redirect(oauth.authorizeUrl(state));
});

authRoutes.get("/auth/callback", async (c) => {
  const { config, oauth } = authDeps;
  if (!config || !oauth) return notConfigured(c);

  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = await getSignedCookie(c, config.sessionSecret, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });
  if (!code || !state || !expectedState || state !== expectedState) {
    return c.redirect(`${webHome()}/?auth=error`);
  }

  try {
    const token = await oauth.exchangeCode(code);
    if (!(await oauth.isGuildMember(token, config.guildId))) {
      // Pas membre → le front affiche l'invite.
      const invite = config.guildInviteUrl ? `&invite=${encodeURIComponent(config.guildInviteUrl)}` : "";
      return c.redirect(`${webHome()}/?auth=not-member${invite}`);
    }
    const user = await oauth.getUser(token);
    // Banni : pas de session, le front gère l'écran.
    if (await isBanned(user.id)) return c.redirect(`${webHome()}/?auth=banned`);
    await writeSession(c, { discordId: user.id, displayName: user.displayName, avatar: user.avatar });
    // Rafraîchit le snapshot (nom/avatar) à chaque login, sinon il reste figé
    // ailleurs. No-op si pas encore inscrit.
    await db
      .update(players)
      .set({ discordName: user.displayName, discordAvatar: user.avatar ?? null })
      .where(eq(players.discordId, user.id));
    return c.redirect(`${webHome()}/?auth=ok`);
  } catch (err) {
    console.error("[auth] callback failed:", err instanceof Error ? err.message : err);
    return c.redirect(`${webHome()}/?auth=error`);
  }
});

authRoutes.post("/auth/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const session = await readSession(c);
  if (!session) return c.json<MeResponse>({ authenticated: false });

  const [player] = await db
    .select({
      id: players.id,
      discordName: players.discordName,
      faceitNickname: players.faceitNickname,
      steamId64: players.steamId64,
      discordAvatar: players.discordAvatar,
      formation: players.formation,
      promoStart: players.promoStart,
      promoEnd: players.promoEnd,
    })
    .from(players)
    .where(eq(players.discordId, session.discordId))
    .limit(1);

  return c.json<MeResponse>({
    authenticated: true,
    discordId: session.discordId,
    displayName: session.displayName,
    isAdmin: await isAdmin(session.discordId),
    // Hash frais de la session, prioritaire sur le snapshot DB (figé à l'inscription).
    avatar: session.avatar ?? null,
    player: player
      ? {
          id: player.id,
          discordId: session.discordId, // matché via discord_id
          discordName: player.discordName,
          faceitNickname: player.faceitNickname,
          steamId64: player.steamId64,
          elo: null, // le front a déjà l'ELO via le leaderboard
          level: null,
          discordAvatar: player.discordAvatar,
          formation: player.formation,
          promoStart: player.promoStart,
          promoEnd: player.promoEnd,
        }
      : null,
  });
});

/** Garde les endpoints admin (B17.4) : 401 sans session, 403 si pas admin. */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const session = await readSession(c);
  if (!session) return c.json({ error: "authentication required" }, 401);
  if (!(await isAdmin(session.discordId))) {
    return c.json({ error: "admin only" }, 403);
  }
  await next();
};

/** Réservé au socle root ADMIN_DISCORD_IDS (B12.10) : gérer les admins reste hors de portée des admins promus. */
export const requireRootAdmin: MiddlewareHandler = async (c, next) => {
  const session = await readSession(c);
  if (!session || !authDeps.config?.adminDiscordIds.includes(session.discordId)) {
    return c.json({ error: "réservé aux admins root (ADMIN_DISCORD_IDS)" }, 403);
  }
  await next();
};
