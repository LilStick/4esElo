import { test, expect } from "@playwright/test";
import { E2E_PLAYER_ID, E2E_NICKNAME } from "./seed";

/**
 * e2e API : on tape le VRAI serveur HTTP (pas app.request in-process) → couvre le
 * boot du serveur, le montage des routes, les headers et le CORS, ce que les
 * tests d'intégration ne voient pas.
 */

test("GET /health → 200 { ok: true, db: true }", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.db).toBe(true);
});

test("GET /leaderboard → le joueur seedé est présent", async ({ request }) => {
  const res = await request.get("/leaderboard");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  // Robuste au format exact du leaderboard (front en mouvement) : on vérifie
  // juste que le pseudo seedé remonte bien dans la réponse.
  expect(JSON.stringify(body)).toContain(E2E_NICKNAME);
});

test("GET /players/:id → profil du joueur seedé", async ({ request }) => {
  const res = await request.get(`/players/${E2E_PLAYER_ID}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.faceitNickname).toBe(E2E_NICKNAME);
  expect(body.elo).toBe(1620);
});

test("GET /players/:id → 404 pour un joueur inconnu", async ({ request }) => {
  const res = await request.get(`/players/00000000-0000-0000-0000-000000000000`);
  expect(res.status()).toBe(404);
});

test("GET /players/:id/og.png → vrai PNG", async ({ request }) => {
  const res = await request.get(`/players/${E2E_PLAYER_ID}/og.png`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  const buf = await res.body();
  expect(buf.length).toBeGreaterThan(1000);
  // Signature PNG : 89 50 4E 47.
  expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
});
