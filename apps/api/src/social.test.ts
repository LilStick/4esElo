import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeDuos,
  computeLineups,
  computePlayerDuos,
  MIN_DUO_MATCHES,
  type SocialMatchRow,
} from "./social";

const PLAYERS = [
  { id: "p1", nickname: "alice", discordId: null, discordAvatar: null },
  { id: "p2", nickname: "bob", discordId: null, discordAvatar: null },
  { id: "p3", nickname: "carol", discordId: null, discordAvatar: null },
  { id: "p4", nickname: "dave", discordId: null, discordAvatar: null },
  { id: "p5", nickname: "erin", discordId: null, discordAvatar: null },
];

/** n matchs où tous les `ids` ont le même résultat (même équipe). */
function stack(ids: string[], results: number[], prefix = "s"): SocialMatchRow[] {
  return results.flatMap((result, i) =>
    ids.map((id) => ({ matchId: `${prefix}-${i}`, playerId: id, result })),
  );
}

/** n matchs où les deux joueurs ont le même résultat (coéquipiers). */
function together(a: string, b: string, results: number[], prefix = "m"): SocialMatchRow[] {
  return results.flatMap((result, i) => [
    { matchId: `${prefix}-${a}-${b}-${i}`, playerId: a, result },
    { matchId: `${prefix}-${a}-${b}-${i}`, playerId: b, result },
  ]);
}

test("duos : même match + même résultat = coéquipiers, winrate calculé", () => {
  const duos = computeDuos(PLAYERS, together("p1", "p2", [1, 1, 1, 0, 1]));
  assert.equal(duos.length, 1);
  const d = duos[0]!;
  assert.deepEqual(
    d.players.map((p) => p.nickname),
    ["alice", "bob"],
  );
  assert.equal(d.matches, 5);
  assert.equal(d.wins, 4);
  assert.equal(d.winRate, 80);
});

test("duos : résultats opposés (adversaires) ne comptent pas", () => {
  const opposed: SocialMatchRow[] = [
    { matchId: "vs-1", playerId: "p1", result: 1 },
    { matchId: "vs-1", playerId: "p2", result: 0 },
  ];
  const duos = computeDuos(PLAYERS, [...together("p1", "p2", [1, 1, 1, 1]), ...opposed]);
  // 4 games ensemble + 1 face à face → sous le minimum de 5, et le face à face n'y contribue pas
  assert.deepEqual(duos, []);
});

test("duos : sous le minimum de games → n'apparaît pas (pas de 100% sur 1 game)", () => {
  const duos = computeDuos(PLAYERS, together("p1", "p2", [1]));
  assert.deepEqual(duos, []);
  assert.equal(computeDuos(PLAYERS, together("p1", "p2", [1, 1, 1, 1, 1]), 5).length, 1);
});

test("duos : tri winrate desc puis volume ; un match à 3 membres produit toutes les paires", () => {
  const wins = Array.from({ length: MIN_DUO_MATCHES }, () => 1);
  const trio: SocialMatchRow[] = wins.flatMap((result, i) => [
    { matchId: `trio-${i}`, playerId: "p1", result },
    { matchId: `trio-${i}`, playerId: "p2", result },
    { matchId: `trio-${i}`, playerId: "p3", result },
  ]);
  // p1+p2 jouent 3 games de plus, en perdent 2 → winrate plus bas mais plus de volume
  const extra = together("p1", "p2", [1, 0, 0], "extra");
  const duos = computeDuos(PLAYERS, [...trio, ...extra]);

  assert.equal(duos.length, 3); // p1+p2, p1+p3, p2+p3
  const top = duos.slice(0, 2);
  assert.ok(top.every((d) => d.winRate === 100)); // les paires du trio pur
  const last = duos[2]!;
  assert.deepEqual(
    last.players.map((p) => p.nickname),
    ["alice", "bob"],
  );
  assert.equal(last.matches, MIN_DUO_MATCHES + 3);
  assert.equal(last.winRate, 75);
});

test("duos d'un joueur : filtrés sur lui, joueurs hors pôle ignorés", () => {
  const rows = [
    ...together("p1", "p2", [1, 1, 1, 1, 1]),
    ...together("p2", "p3", [0, 0, 0, 0, 0], "other"),
    // un randon du match qui n'est pas membre → ignoré
    { matchId: "m-p1-p2-0", playerId: "stranger", result: 1 },
  ];
  const mine = computePlayerDuos("p1", PLAYERS, rows);
  assert.equal(mine.length, 1);
  assert.ok(mine[0]!.players.some((p) => p.id === "p1"));
  assert.equal(computePlayerDuos("p3", PLAYERS, rows)[0]!.winRate, 0);
});

test("duos : aucun match commun → liste vide", () => {
  assert.deepEqual(computeDuos(PLAYERS, []), []);
});

test("lineups : un trio qui joue ≥ 3 games ensemble apparaît, winrate calculé", () => {
  const lineups = computeLineups(PLAYERS, stack(["p1", "p2", "p3"], [1, 1, 0])); // 3 games, 2 wins
  assert.equal(lineups.length, 1);
  const l = lineups[0]!;
  assert.equal(l.size, 3);
  assert.deepEqual(
    l.players.map((p) => p.nickname),
    ["alice", "bob", "carol"],
  );
  assert.equal(l.matches, 3);
  assert.equal(l.wins, 2);
  assert.equal(l.winRate, 66.7);
});

test("lineups : un groupe de 2 membres = territoire des duos, ignoré", () => {
  assert.deepEqual(computeLineups(PLAYERS, stack(["p1", "p2"], [1, 1, 1, 1])), []);
});

test("lineups : sous le minimum de games → n'apparaît pas", () => {
  assert.deepEqual(computeLineups(PLAYERS, stack(["p1", "p2", "p3"], [1, 1])), []); // 2 < 3
});

test("lineups : un 5-stack alimente tous les sous-groupes 3/4/5", () => {
  const lineups = computeLineups(PLAYERS, stack(["p1", "p2", "p3", "p4", "p5"], [1, 1, 1]));
  assert.equal(lineups.length, 16); // C(5,3)=10 + C(5,4)=5 + C(5,5)=1
  assert.ok(lineups.every((l) => l.winRate === 100 && l.matches === 3));
  assert.equal(lineups.filter((l) => l.size === 5).length, 1);
  assert.equal(lineups.filter((l) => l.size === 4).length, 5);
  assert.equal(lineups.filter((l) => l.size === 3).length, 10);
});

test("lineups : résultats opposés ne groupent pas (pas d'équipe de 3)", () => {
  const rows: SocialMatchRow[] = [
    { matchId: "x", playerId: "p1", result: 1 },
    { matchId: "x", playerId: "p2", result: 1 },
    { matchId: "x", playerId: "p3", result: 0 }, // adversaire
  ];
  assert.deepEqual(computeLineups(PLAYERS, rows), []);
});
