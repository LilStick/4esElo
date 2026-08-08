import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";
import { db } from "@4eselo/db";
import { WEB_ORIGINS } from "./env";
import type { ConfigResponse } from "@4eselo/types";
import { authRoutes } from "./auth";
import { registerRoutes } from "./register";
import { adminRoutes } from "./admin";
import { presenceRoutes } from "./presenceRoutes";
import { leaderboardRoutes } from "./leaderboard";
import { playersRoutes } from "./players";
import { matchesRoutes } from "./matches";
import { activityRoutes } from "./activity";
import { duosRoutes } from "./duos";
import { announcementsRoutes } from "./announcements";
import { wrappedRoutes } from "./wrappedRoutes";
import { ideasRoutes } from "./ideas";
import { refreshRoutes } from "./refresh";
import { seasonsRoutes } from "./seasons";
import { ogRoutes } from "./og";
import { premierRoutes, premierDeps } from "./premier";

export const app = new Hono();
app.use("*", cors({ origin: WEB_ORIGINS, credentials: true }));

// 500 structuré, jamais de stack trace au client.
app.onError((err, c) => {
  console.error(`[api] ${c.req.method} ${c.req.path} failed:`, err.message);
  return c.json({ error: "internal error" }, 500);
});

// Gate serveur de la surface Premier en LECTURE (B18.21) : quand le flag est off, on
// FERME vraiment `?source=premier` et `/premier/matches` (403), au lieu de compter sur
// le seul masquage front. `premierDeps.enabled` = flag runtime unique (aussi flippé en
// test). Les routes d'onboarding gardent leur propre garde 503 (non concernées ici).
app.use("*", async (c, next) => {
  if (premierDeps.enabled) return next();
  const wantsPremier = c.req.query("source") === "premier" || /\/premier\/matches$/.test(c.req.path);
  if (wantsPremier) return c.json({ error: "premier disabled" }, 403);
  return next();
});

// Config publique (B18.13) : le front lit les feature flags, même anonyme.
app.get("/config", (c) => c.json<ConfigResponse>({ premierEnabled: premierDeps.enabled }));

app.get("/health", async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ ok: true, db: true });
  } catch {
    return c.json({ ok: false, db: false }, 503);
  }
});

// Un routeur par domaine (validation + I/O fins) ; la logique métier vit dans les modules purs.
app.route("/", authRoutes);
app.route("/", registerRoutes);
app.route("/", adminRoutes);
app.route("/", presenceRoutes);
app.route("/", leaderboardRoutes);
app.route("/", playersRoutes);
app.route("/", matchesRoutes);
app.route("/", activityRoutes);
app.route("/", duosRoutes);
app.route("/", announcementsRoutes);
app.route("/", wrappedRoutes);
app.route("/", ideasRoutes);
app.route("/", refreshRoutes);
app.route("/", seasonsRoutes);
app.route("/", ogRoutes);
app.route("/", premierRoutes);
