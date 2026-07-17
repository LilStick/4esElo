import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";
import { db } from "@4eselo/db";
import { WEB_ORIGINS } from "./env";
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
import { ogRoutes } from "./og";
import { premierRoutes } from "./premier";

export const app = new Hono();
app.use("*", cors({ origin: WEB_ORIGINS, credentials: true }));

// 500 structuré, jamais de stack trace au client.
app.onError((err, c) => {
  console.error(`[api] ${c.req.method} ${c.req.path} failed:`, err.message);
  return c.json({ error: "internal error" }, 500);
});

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
app.route("/", ogRoutes);
app.route("/", premierRoutes);
