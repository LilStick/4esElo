import { test } from "node:test";
import assert from "node:assert/strict";
import { rawPlayerSchema, normalizePlayer } from "./schemas";

/**
 * Non-régression Season 8 : un joueur en placement (Unranked, ELO/level cachés)
 * ne doit plus faire planter le parse (avant : faceit_elo/skill_level requis → throw
 * → sync du membre cassé). On vérifie le parse tolérant + l'état unranked normalisé.
 */

const base = { player_id: "fc-1", nickname: "noe", avatar: "", country: "fr" };
const parse = (raw: unknown) => normalizePlayer(rawPlayerSchema.parse(raw));

test("joueur classé → elo/level renseignés, unranked false", () => {
  const p = parse({ ...base, games: { cs2: { faceit_elo: 1477, skill_level: 7, game_player_id: "765" } } });
  assert.deepEqual(p.cs2, { elo: 1477, skillLevel: 7, steamId64: "765", unranked: false });
});

test("placement : skill_level 0 → unranked, elo/level null (même si faceit_elo présent)", () => {
  // ELO résiduel parfois renvoyé mais caché côté produit : on ne le garde pas.
  const p = parse({ ...base, games: { cs2: { faceit_elo: 1000, skill_level: 0, game_player_id: "765" } } });
  assert.deepEqual(p.cs2, { elo: null, skillLevel: null, steamId64: "765", unranked: true });
});

test("placement : faceit_elo et skill_level absents → parse OK (plus de throw) + unranked", () => {
  const p = parse({ ...base, games: { cs2: { game_player_id: "765" } } });
  assert.equal(p.cs2?.unranked, true);
  assert.equal(p.cs2?.elo, null);
  assert.equal(p.cs2?.steamId64, "765");
});

test("games.cs2 absent → cs2 null (jamais joué CS2, distinct du placement)", () => {
  const p = parse({ ...base, games: {} });
  assert.equal(p.cs2, null);
});
