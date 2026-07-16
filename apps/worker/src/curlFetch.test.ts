import { test } from "node:test";
import assert from "node:assert/strict";
import { toResponseStatus } from "./curlFetch";

// Régression : curl renvoie 000 (→ 0) quand aucune réponse HTTP n'arrive
// (Cloudflare coupe, timeout, reset TLS). `new Response(body, { status: 0 })`
// throw un RangeError qui échappait au catch "blocked" → backfill crashait au
// lieu de dégrader. On ramène tout status hors 200-599 à 503.
test("toResponseStatus ramène un code hors plage à 503", () => {
  assert.equal(toResponseStatus(0), 503); // curl 000 = pas de réponse
  assert.equal(toResponseStatus(100), 503); // 1xx non constructible par Response
  assert.equal(toResponseStatus(600), 503);
});

test("toResponseStatus laisse passer un code HTTP valide", () => {
  assert.equal(toResponseStatus(200), 200);
  assert.equal(toResponseStatus(403), 403); // le vrai signal Cloudflare "bloqué"
  assert.equal(toResponseStatus(599), 599);
});
