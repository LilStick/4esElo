import { test } from "node:test";
import assert from "node:assert/strict";
import {
  announceWrapped,
  previousMonth,
  type AnnouncementStore,
  type AnnouncementToInsert,
  type MonthActivityReader,
} from "./announceWrapped";

function fakes(opts: { hasMatches: boolean; alreadyAnnounced?: boolean }) {
  const inserted: AnnouncementToInsert[] = [];
  const store: AnnouncementStore = {
    async insertUnique(a) {
      if (opts.alreadyAnnounced) return false;
      inserted.push(a);
      return true;
    },
  };
  const reader: MonthActivityReader = {
    async monthHasMatches() {
      return opts.hasMatches;
    },
  };
  return { store, reader, inserted };
}

const july3 = () => new Date("2026-07-03T09:00:00Z");

test("previousMonth : mois écoulé en UTC, janvier retombe sur décembre N-1", () => {
  assert.deepEqual(previousMonth(new Date("2026-07-01T00:00:00Z")), { year: 2026, month: 6 });
  assert.deepEqual(previousMonth(new Date("2026-01-15T00:00:00Z")), { year: 2025, month: 12 });
});

test("annonce le Wrapped du mois écoulé : titre, lien front et clé de dédup", async () => {
  const { store, reader, inserted } = fakes({ hasMatches: true });
  const res = await announceWrapped(store, reader, july3);

  assert.deepEqual(res, { status: "posted", year: 2026, month: 6 });
  assert.equal(inserted.length, 1);
  assert.deepEqual(inserted[0], {
    type: "wrapped",
    title: "Le Wrapped de juin est là 🎁",
    linkUrl: "/wrapped/juin-2026",
    dedupeKey: "wrapped-2026-06",
  });
});

test("déjà annoncé (relance dans le mois) → no-op, pas de doublon", async () => {
  const { store, reader } = fakes({ hasMatches: true, alreadyAnnounced: true });
  const res = await announceWrapped(store, reader, july3);
  assert.deepEqual(res, { status: "already-announced", year: 2026, month: 6 });
});

test("mois sans matchs → pas d'annonce", async () => {
  const { store, reader, inserted } = fakes({ hasMatches: false });
  const res = await announceWrapped(store, reader, july3);
  assert.deepEqual(res, { status: "empty-month", year: 2026, month: 6 });
  assert.equal(inserted.length, 0);
});

test("le changement de mois change la clé : le 1er du mois suivant, ça repart", async () => {
  const { store, reader, inserted } = fakes({ hasMatches: true });
  await announceWrapped(store, reader, () => new Date("2026-08-01T00:05:00Z"));
  assert.equal(inserted[0]!.dedupeKey, "wrapped-2026-07");
  assert.equal(inserted[0]!.linkUrl, "/wrapped/juillet-2026");
});
