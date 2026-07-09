import { test } from "node:test";
import assert from "node:assert/strict";
import { announceBigWrapped, previousYear, type PeriodActivityReader } from "./announceBigWrapped";
import type { AnnouncementStore, AnnouncementToInsert } from "./announce";

function fakes(opts: { hasMatches: boolean; alreadyAnnounced?: boolean }) {
  const inserted: AnnouncementToInsert[] = [];
  const store: AnnouncementStore = {
    async insertUnique(a) {
      if (opts.alreadyAnnounced) return false;
      inserted.push(a);
      return true;
    },
  };
  const reader: PeriodActivityReader = {
    async hasMatchesInRange() {
      return opts.hasMatches;
    },
  };
  return { store, reader, inserted };
}

const jan2027 = () => new Date("2027-01-03T09:00:00Z"); // année écoulée = 2026

test("previousYear : année écoulée en UTC", () => {
  assert.equal(previousYear(new Date("2027-01-01T00:00:00Z")), 2026);
  assert.equal(previousYear(new Date("2026-12-31T23:59:59Z")), 2025);
});

test("annonce le BIG Wrapped de l'année écoulée : titre, lien front, clé de dédup", async () => {
  const { store, reader, inserted } = fakes({ hasMatches: true });
  const res = await announceBigWrapped(store, reader, jan2027);
  assert.deepEqual(res, { status: "posted", year: 2026 });
  assert.equal(inserted.length, 1);
  assert.deepEqual(inserted[0], {
    type: "big-wrapped",
    title: "Le BIG Wrapped 2026 est là 🎆",
    linkUrl: "/wrapped/big/2026",
    dedupeKey: "big-wrapped-2026",
  });
});

test("déjà annoncé → no-op, pas de doublon", async () => {
  const { store, reader } = fakes({ hasMatches: true, alreadyAnnounced: true });
  assert.deepEqual(await announceBigWrapped(store, reader, jan2027), {
    status: "already-announced",
    year: 2026,
  });
});

test("année sans matchs → pas d'annonce", async () => {
  const { store, reader, inserted } = fakes({ hasMatches: false });
  assert.deepEqual(await announceBigWrapped(store, reader, jan2027), {
    status: "empty-period",
    year: 2026,
  });
  assert.equal(inserted.length, 0);
});
