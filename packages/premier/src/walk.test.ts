import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatchWalker, decodeShareCode, ShareCodeExpiredError } from "./walk";

// Vecteurs réels mesurés sur des share codes de prod (spike 2026-07-17).
test("decodeShareCode : vecteurs réels", () => {
  const a = decodeShareCode("CSGO-VGAOZ-Fukap-pA46K-3nszD-FdcNE");
  assert.equal(a.matchId, 16241302204282044995n);
  assert.equal(a.reservationId, 16784245504542493870n);
  assert.equal(a.tvPort, 20474);

  const b = decodeShareCode("CSGO-sRVoD-oNCOC-8cYFC-OPpqh-qESyL");
  assert.equal(b.matchId, 9643431449853249708n);
  assert.equal(b.reservationId, 16415843748274781599n);
  assert.equal(b.tvPort, 56369);
});

test("decodeShareCode : rejette un code malformé", () => {
  assert.throws(() => decodeShareCode("CSGO-nope"));
});

function fakeFetch(responses: Array<{ status: number; nextcode?: string }>): typeof fetch {
  let i = 0;
  return (async () => {
    const r = responses[i++]!;
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => ({ result: { nextcode: r.nextcode } }),
    } as Response;
  }) as typeof fetch;
}

// Walker de test : fetch mocké, pas d'attente réelle (sleep no-op).
const mk = (responses: Array<{ status: number; nextcode?: string }>) =>
  createMatchWalker("KEY", { fetchImpl: fakeFetch(responses), sleep: async () => {}, throttleMs: 0 });

test("nextShareCode : renvoie le code suivant (200)", async () => {
  const w = mk([{ status: 200, nextcode: "CSGO-aaaaa-bbbbb-ccccc-ddddd-eeeee" }]);
  assert.equal(await w.nextShareCode("sid", "auth", "CSGO-x"), "CSGO-aaaaa-bbbbb-ccccc-ddddd-eeeee");
});

test("nextShareCode : fin d'historique (202 ou nextcode n/a) → null", async () => {
  assert.equal(await mk([{ status: 202 }]).nextShareCode("sid", "auth", "CSGO-x"), null);
  assert.equal(await mk([{ status: 200, nextcode: "n/a" }]).nextShareCode("sid", "auth", "CSGO-x"), null);
});

test("nextShareCode : 412 → ShareCodeExpiredError", async () => {
  await assert.rejects(
    () => mk([{ status: 412 }]).nextShareCode("sid", "auth", "CSGO-old"),
    ShareCodeExpiredError,
  );
});

test("nextShareCode : 429 → backoff puis succès", async () => {
  const w = mk([{ status: 429 }, { status: 429 }, { status: 200, nextcode: "CSGO-après-backoff" }]);
  assert.equal(await w.nextShareCode("sid", "auth", "CSGO-x"), "CSGO-après-backoff");
});

test("nextShareCode : 429 persistant (> maxRetries) → throw", async () => {
  const w = createMatchWalker("KEY", {
    fetchImpl: fakeFetch(Array.from({ length: 6 }, () => ({ status: 429 }))),
    sleep: async () => {},
    maxRetries: 2,
  });
  await assert.rejects(() => w.nextShareCode("sid", "auth", "CSGO-x"), /429/);
});

test("walkFrom : chaîne jusqu'à la fin", async () => {
  const w = mk([
    { status: 200, nextcode: "CSGO-1" },
    { status: 200, nextcode: "CSGO-2" },
    { status: 200, nextcode: "CSGO-3" },
    { status: 200, nextcode: "n/a" },
  ]);
  assert.deepEqual(await w.walkFrom("sid", "auth", "CSGO-seed"), ["CSGO-1", "CSGO-2", "CSGO-3"]);
});

test("walkFrom : respecte la limite max", async () => {
  const w = mk([
    { status: 200, nextcode: "CSGO-1" },
    { status: 200, nextcode: "CSGO-2" },
    { status: 200, nextcode: "CSGO-3" },
  ]);
  assert.deepEqual(await w.walkFrom("sid", "auth", "CSGO-seed", { max: 2 }), ["CSGO-1", "CSGO-2"]);
});
