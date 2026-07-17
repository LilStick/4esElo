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

test("nextShareCode : renvoie le code suivant (200)", async () => {
  const w = createMatchWalker(
    "KEY",
    fakeFetch([{ status: 200, nextcode: "CSGO-aaaaa-bbbbb-ccccc-ddddd-eeeee" }]),
  );
  assert.equal(await w.nextShareCode("sid", "auth", "CSGO-x"), "CSGO-aaaaa-bbbbb-ccccc-ddddd-eeeee");
});

test("nextShareCode : fin d'historique (202 ou nextcode n/a) → null", async () => {
  const w202 = createMatchWalker("KEY", fakeFetch([{ status: 202 }]));
  assert.equal(await w202.nextShareCode("sid", "auth", "CSGO-x"), null);
  const wna = createMatchWalker("KEY", fakeFetch([{ status: 200, nextcode: "n/a" }]));
  assert.equal(await wna.nextShareCode("sid", "auth", "CSGO-x"), null);
});

test("nextShareCode : 412 → ShareCodeExpiredError", async () => {
  const w = createMatchWalker("KEY", fakeFetch([{ status: 412 }]));
  await assert.rejects(() => w.nextShareCode("sid", "auth", "CSGO-old"), ShareCodeExpiredError);
});

test("walkFrom : chaîne jusqu'à la fin", async () => {
  const w = createMatchWalker(
    "KEY",
    fakeFetch([
      { status: 200, nextcode: "CSGO-1" },
      { status: 200, nextcode: "CSGO-2" },
      { status: 200, nextcode: "CSGO-3" },
      { status: 200, nextcode: "n/a" },
    ]),
  );
  assert.deepEqual(await w.walkFrom("sid", "auth", "CSGO-seed"), ["CSGO-1", "CSGO-2", "CSGO-3"]);
});

test("walkFrom : respecte la limite max", async () => {
  const w = createMatchWalker(
    "KEY",
    fakeFetch([
      { status: 200, nextcode: "CSGO-1" },
      { status: 200, nextcode: "CSGO-2" },
      { status: 200, nextcode: "CSGO-3" },
    ]),
  );
  assert.deepEqual(await w.walkFrom("sid", "auth", "CSGO-seed", { max: 2 }), ["CSGO-1", "CSGO-2"]);
});
