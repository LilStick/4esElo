import { test } from "node:test";
import assert from "node:assert/strict";
import {
  announceWeeklyRecap,
  buildDigest,
  formatRecapBody,
  isoWeek,
  previousWeekRange,
  type PlayerWeekActivity,
  type WeekActivityReader,
} from "./weeklyRecap";
import type { AnnouncementStore, AnnouncementToInsert } from "./announce";

function fakes(activity: PlayerWeekActivity[], opts?: { alreadyAnnounced?: boolean }) {
  const inserted: AnnouncementToInsert[] = [];
  const store: AnnouncementStore = {
    async insertUnique(a) {
      if (opts?.alreadyAnnounced) return false;
      inserted.push(a);
      return true;
    },
  };
  const reader: WeekActivityReader = {
    async weekActivity() {
      return activity;
    },
  };
  return { store, reader, inserted };
}

// Mercredi 8 juillet 2026 → la semaine écoulée est celle du lundi 29 juin (ISO 2026-W27).
const wed = () => new Date("2026-07-08T09:00:00Z");

test("previousWeekRange : la semaine ISO écoulée, lundi→lundi UTC", () => {
  const r = previousWeekRange(new Date("2026-07-08T09:00:00Z"));
  assert.equal(r.start.toISOString(), "2026-06-29T00:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-07-06T00:00:00.000Z");
  assert.deepEqual({ year: r.year, week: r.week }, { year: 2026, week: 27 });
});

test("previousWeekRange : un lundi, on résume bien la semaine d'avant (pas la courante)", () => {
  // Lundi 6 juillet 00:05 → semaine écoulée = 29 juin → 6 juillet.
  const r = previousWeekRange(new Date("2026-07-06T00:05:00Z"));
  assert.equal(r.start.toISOString(), "2026-06-29T00:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-07-06T00:00:00.000Z");
});

test("isoWeek : le 4 janvier est toujours en semaine 1 (règle ISO)", () => {
  assert.deepEqual(isoWeek(new Date("2026-01-04T12:00:00Z")), { year: 2026, week: 1 });
  // 1er janvier 2027 = jeudi → W53 de 2026 côté ISO.
  assert.deepEqual(isoWeek(new Date("2026-12-28T00:00:00Z")), { year: 2026, week: 53 });
});

test("buildDigest : grinder, meilleure progression et pire semaine", () => {
  const d = buildDigest([
    { nickname: "zowi-", games: 11, eloDelta: 87 },
    { nickname: "Alyex_", games: 4, eloDelta: 120 },
    { nickname: "bob", games: 6, eloDelta: -64 },
  ]);
  assert.equal(d.totalGames, 21);
  assert.deepEqual(d.grinder, { nickname: "zowi-", games: 11 });
  assert.deepEqual(d.topGain, { nickname: "Alyex_", delta: 120 });
  assert.deepEqual(d.topLoss, { nickname: "bob", delta: -64 });
});

test("buildDigest : eloDelta inconnu (null) exclu des classements ELO", () => {
  const d = buildDigest([
    { nickname: "newbie", games: 3, eloDelta: null },
    { nickname: "steady", games: 2, eloDelta: 0 },
  ]);
  assert.equal(d.totalGames, 5);
  assert.deepEqual(d.grinder, { nickname: "newbie", games: 3 });
  // delta 0 n'est ni un gain ni une perte ; null est ignoré.
  assert.equal(d.topGain, null);
  assert.equal(d.topLoss, null);
});

test("formatRecapBody : singulier/pluriel et lignes présentes uniquement si data", () => {
  const full = formatRecapBody({
    totalGames: 21,
    grinder: { nickname: "zowi-", games: 11 },
    topGain: { nickname: "Alyex_", delta: 120 },
    topLoss: { nickname: "bob", delta: -64 },
  });
  assert.match(full, /^21 games jouées cette semaine 🎮/);
  assert.match(full, /📈 Plus belle progression : Alyex_ \(\+120 ELO\)/);
  assert.match(full, /📉 Plus dure semaine : bob \(-64 ELO\)/);

  const solo = formatRecapBody({
    totalGames: 1,
    grinder: { nickname: "zowi-", games: 1 },
    topGain: null,
    topLoss: null,
  });
  assert.match(solo, /^1 game jouée cette semaine/);
  assert.ok(!solo.includes("📈"));
});

test("announceWeeklyRecap : semaine active → posted avec titre, body et clé de dédup", async () => {
  const { store, reader, inserted } = fakes([
    { nickname: "zowi-", games: 11, eloDelta: 87 },
    { nickname: "bob", games: 6, eloDelta: -64 },
  ]);
  const res = await announceWeeklyRecap(store, reader, wed);

  assert.equal(res.status, "posted");
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]!.type, "weekly-recap");
  assert.equal(inserted[0]!.title, "La semaine du pôle 📅");
  assert.equal(inserted[0]!.dedupeKey, "weekly-recap-2026-W27");
  assert.match(inserted[0]!.body ?? "", /17 games jouées/);
});

test("announceWeeklyRecap : semaine sans game → empty-week, aucune annonce", async () => {
  const { store, reader, inserted } = fakes([]);
  const res = await announceWeeklyRecap(store, reader, wed);
  assert.deepEqual(res, { status: "empty-week", year: 2026, week: 27 });
  assert.equal(inserted.length, 0);
});

test("announceWeeklyRecap : déjà annoncé (relance) → no-op, pas de doublon", async () => {
  const { store, reader } = fakes([{ nickname: "zowi-", games: 3, eloDelta: 10 }], {
    alreadyAnnounced: true,
  });
  const res = await announceWeeklyRecap(store, reader, wed);
  assert.equal(res.status, "already-announced");
});
