import { test } from "node:test";
import assert from "node:assert/strict";
import type { AwardKey, FaceitMatchStats } from "@4eselo/types";
import {
  computeAwards,
  computePlayerWrapped,
  monthRange,
  parisHour,
  MIN_MATCHES,
  type WrappedInputs,
  type WrappedMatch,
} from "./wrapped";

function makeStats(over: Partial<FaceitMatchStats> = {}): FaceitMatchStats {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    kd: 0,
    kr: 0,
    adr: 0,
    damage: 0,
    hsPercent: 0,
    mvps: 0,
    doubleKills: 0,
    tripleKills: 0,
    quadroKills: 0,
    pentaKills: 0,
    clutch1v1Count: 0,
    clutch1v1Wins: 0,
    clutch1v2Count: 0,
    clutch1v2Wins: 0,
    clutchKills: 0,
    entryCount: 0,
    entryWins: 0,
    firstKills: 0,
    utilityDamage: 0,
    utilityCount: 0,
    flashCount: 0,
    enemiesFlashed: 0,
    flashSuccesses: 0,
    sniperKills: 0,
    ...over,
  };
}

/** N matchs identiques pour un joueur — l'après-midi (pas nolife) sur des maps variées par défaut. */
function games(
  playerId: string,
  n: number,
  over: Partial<FaceitMatchStats> = {},
  extra: Partial<Pick<WrappedMatch, "map" | "playedAt" | "result">> = {},
): WrappedMatch[] {
  return Array.from({ length: n }, (_, i) => ({
    playerId,
    map: extra.map ?? `de_map${i % 3}`,
    playedAt: extra.playedAt ?? new Date(`2026-06-10T15:0${i % 10}:00Z`),
    result: extra.result ?? 1,
    stats: makeStats(over),
  }));
}

function inputs(over: Partial<WrappedInputs> = {}): WrappedInputs {
  return {
    players: [
      { id: "p1", nickname: "alice", discordId: null, discordAvatar: null },
      { id: "p2", nickname: "bob", discordId: null, discordAvatar: null },
    ],
    matches: [],
    eloSnapshots: [],
    playtimeSnapshots: [],
    ...over,
  };
}

const winnersOf = (all: ReturnType<typeof computeAwards>, key: AwardKey) =>
  all.filter((a) => a.award === key);

test("mois vide → aucun award (pas même Fantôme : personne n'a joué)", () => {
  assert.deepEqual(computeAwards(inputs()), []);
});

test("rat : frags hauts + entrys sous la médiane gagne ; entry-fragger écarté", () => {
  const awards = computeAwards(
    inputs({
      matches: [
        ...games("p1", MIN_MATCHES, { kills: 25, entryCount: 1 }),
        // bob fragge plus MAIS entre en premier tout le temps → pas un rat
        ...games("p2", MIN_MATCHES, { kills: 30, entryCount: 9 }),
      ],
    }),
  );
  const rats = winnersOf(awards, "rat");
  assert.equal(rats.length, 1);
  assert.equal(rats[0]!.playerId, "p1");
  assert.equal(rats[0]!.value, 25);
});

test("rat : personne avec assez de games → pas de rat", () => {
  const awards = computeAwards(
    inputs({ matches: games("p1", MIN_MATCHES - 1, { kills: 30, entryCount: 0 }) }),
  );
  assert.deepEqual(winnersOf(awards, "rat"), []);
});

test("spammeur : le plus de flashs + utility par game", () => {
  const awards = computeAwards(
    inputs({
      matches: [
        ...games("p1", MIN_MATCHES, { flashCount: 8, utilityCount: 12 }),
        ...games("p2", MIN_MATCHES, { flashCount: 2, utilityCount: 3 }),
      ],
    }),
  );
  const smokes = winnersOf(awards, "spammeur");
  assert.equal(smokes.length, 1);
  assert.equal(smokes[0]!.playerId, "p1");
  assert.equal(smokes[0]!.value, 20);
});

test("spammeur : zéro grenade lancée dans le pôle → personne", () => {
  const awards = computeAwards(inputs({ matches: games("p1", MIN_MATCHES) }));
  assert.deepEqual(winnersOf(awards, "spammeur"), []);
});

test("puant : one-trick qui win sur sa map ; le joueur varié ne gagne pas", () => {
  const awards = computeAwards(
    inputs({
      matches: [
        // alice : 5/5 games sur mirage, 4 wins
        ...games("p1", 4, {}, { map: "de_mirage", result: 1 }),
        ...games("p1", 1, {}, { map: "de_mirage", result: 0 }),
        // bob : maps variées (≤ 40% de share)
        ...games("p2", MIN_MATCHES, {}, { result: 1 }),
      ],
    }),
  );
  const stinky = winnersOf(awards, "puant");
  assert.equal(stinky.length, 1);
  assert.equal(stinky[0]!.playerId, "p1");
});

test("puant : one-trick qui perd sa map → personne", () => {
  const awards = computeAwards(
    inputs({ matches: games("p1", MIN_MATCHES, {}, { map: "de_mirage", result: 0 }) }),
  );
  assert.deepEqual(winnersOf(awards, "puant"), []);
});

test("chute libre : pire ΔELO négatif, valeur signée", () => {
  const awards = computeAwards(
    inputs({
      matches: [...games("p1", MIN_MATCHES), ...games("p2", MIN_MATCHES)],
      eloSnapshots: [
        { playerId: "p1", elo: 2000, capturedAt: new Date("2026-06-01T00:00:00Z") },
        { playerId: "p1", elo: 1850, capturedAt: new Date("2026-06-30T00:00:00Z") },
        { playerId: "p2", elo: 1500, capturedAt: new Date("2026-06-01T00:00:00Z") },
        { playerId: "p2", elo: 1480, capturedAt: new Date("2026-06-30T00:00:00Z") },
      ],
    }),
  );
  const falls = winnersOf(awards, "chute-libre");
  assert.equal(falls.length, 1);
  assert.equal(falls[0]!.playerId, "p1");
  assert.equal(falls[0]!.value, -150);
});

test("chute libre : tout le monde monte → personne", () => {
  const awards = computeAwards(
    inputs({
      eloSnapshots: [
        { playerId: "p1", elo: 1000, capturedAt: new Date("2026-06-01T00:00:00Z") },
        { playerId: "p1", elo: 1100, capturedAt: new Date("2026-06-30T00:00:00Z") },
      ],
    }),
  );
  assert.deepEqual(winnersOf(awards, "chute-libre"), []);
});

test("tryharder : le plus de games ; ex æquo → les deux gagnent, triés par pseudo", () => {
  const awards = computeAwards(
    inputs({
      matches: [...games("p1", 8), ...games("p2", 8)],
    }),
  );
  const grinders = winnersOf(awards, "tryharder");
  assert.equal(grinders.length, 2);
  assert.deepEqual(
    grinders.map((w) => w.nickname),
    ["alice", "bob"],
  );
  assert.equal(grinders[0]!.value, 8);
});

test("tryharder : personne n'atteint le minimum de games → personne", () => {
  const awards = computeAwards(inputs({ matches: games("p1", MIN_MATCHES - 1) }));
  assert.deepEqual(winnersOf(awards, "tryharder"), []);
});

test("ministre du clutch : meilleur taux avec assez d'occasions ; trop peu d'occasions écarté", () => {
  const awards = computeAwards(
    inputs({
      matches: [
        // alice : 6 occasions, 4 gagnées (67%)
        ...games("p1", MIN_MATCHES, { clutch1v1Count: 1, clutch1v1Wins: 1 }),
        ...games("p1", 1, { clutch1v2Count: 1, clutch1v2Wins: 0 }),
        // bob : 100% mais 1 seule occasion → pas ministre
        ...games("p2", MIN_MATCHES, {}),
        ...games("p2", 1, { clutch1v1Count: 1, clutch1v1Wins: 1 }),
      ],
    }),
  );
  const ministers = winnersOf(awards, "ministre-du-clutch");
  assert.equal(ministers.length, 1);
  assert.equal(ministers[0]!.playerId, "p1");
});

test("ministre du clutch : aucune situation de clutch → personne", () => {
  const awards = computeAwards(inputs({ matches: games("p1", MIN_MATCHES) }));
  assert.deepEqual(winnersOf(awards, "ministre-du-clutch"), []);
});

test("nolife : games entre 1h et 7h heure de Paris ; joueur diurne écarté", () => {
  // 01:30 Paris en été = 23:30 UTC la veille
  const lateNight = new Date("2026-06-14T23:30:00Z");
  assert.equal(parisHour(lateNight), 1);
  const awards = computeAwards(
    inputs({
      matches: [
        ...games("p1", MIN_MATCHES - 2),
        ...games("p1", 2, {}, { playedAt: lateNight }),
        ...games("p2", MIN_MATCHES),
      ],
    }),
  );
  const owls = winnersOf(awards, "nolife");
  assert.equal(owls.length, 1);
  assert.equal(owls[0]!.playerId, "p1");
  assert.equal(owls[0]!.value, 2);
});

test("nolife : tout le monde dort la nuit → personne", () => {
  const awards = computeAwards(inputs({ matches: games("p1", MIN_MATCHES) }));
  assert.deepEqual(winnersOf(awards, "nolife"), []);
});

test("abonné absent : le moins de minutes jouées ; heures privées écartées", () => {
  const awards = computeAwards(
    inputs({
      matches: games("p2", MIN_MATCHES),
      playtimeSnapshots: [
        { playerId: "p1", minutesForever: 10000, capturedAt: new Date("2026-06-01T00:00:00Z") },
        { playerId: "p1", minutesForever: 10060, capturedAt: new Date("2026-06-30T00:00:00Z") },
        { playerId: "p2", minutesForever: 5000, capturedAt: new Date("2026-06-01T00:00:00Z") },
        { playerId: "p2", minutesForever: 8000, capturedAt: new Date("2026-06-30T00:00:00Z") },
      ],
    }),
  );
  const absent = winnersOf(awards, "abonne-absent");
  assert.equal(absent.length, 1);
  assert.equal(absent[0]!.playerId, "p1");
  assert.equal(absent[0]!.value, 60);
});

test("abonné absent : playtime privé partout → personne", () => {
  const awards = computeAwards(
    inputs({
      playtimeSnapshots: [
        { playerId: "p1", minutesForever: null, capturedAt: new Date("2026-06-01T00:00:00Z") },
        { playerId: "p1", minutesForever: null, capturedAt: new Date("2026-06-30T00:00:00Z") },
      ],
    }),
  );
  assert.deepEqual(winnersOf(awards, "abonne-absent"), []);
});

test("fantôme : 0 game alors que le pôle joue ; dispensé du minimum de games", () => {
  const awards = computeAwards(inputs({ matches: games("p1", MIN_MATCHES) }));
  const ghosts = winnersOf(awards, "fantome");
  assert.equal(ghosts.length, 1);
  assert.equal(ghosts[0]!.playerId, "p2");
});

test("fantôme : personne n'a joué → pas de fantôme (le pôle entier était absent)", () => {
  const awards = computeAwards(inputs());
  assert.deepEqual(winnersOf(awards, "fantome"), []);
});

test("wrapped perso : top map, elo, playtime, percentiles et awards du joueur", () => {
  const base = inputs({
    matches: [
      ...games("p1", 4, { kills: 20, deaths: 10, adr: 90 }, { map: "de_mirage", result: 1 }),
      ...games("p1", 2, { kills: 20, deaths: 10, adr: 90 }, { map: "de_dust2", result: 0 }),
      ...games("p2", 3, { kills: 10, deaths: 20, adr: 60 }, { result: 0 }),
    ],
    eloSnapshots: [
      { playerId: "p1", elo: 1500, capturedAt: new Date("2026-06-01T00:00:00Z") },
      { playerId: "p1", elo: 1620, capturedAt: new Date("2026-06-30T00:00:00Z") },
    ],
    playtimeSnapshots: [
      { playerId: "p1", minutesForever: 1000, capturedAt: new Date("2026-06-01T00:00:00Z") },
      { playerId: "p1", minutesForever: 1900, capturedAt: new Date("2026-06-30T00:00:00Z") },
    ],
  });
  const w = computePlayerWrapped("p1", 2026, 6, base);
  assert.ok(w);
  assert.equal(w.matches, 6);
  assert.equal(w.wins, 4);
  assert.deepEqual(w.topMap, { map: "de_mirage", matches: 4, winRate: 100 });
  assert.deepEqual(w.elo, { start: 1500, end: 1620, delta: 120 });
  assert.equal(w.playtimeMinutes, 900);
  // p1 domine les 2 actifs du mois sur tout → 100e percentile
  assert.deepEqual(w.percentiles, { matches: 100, winRate: 100, kd: 100, adr: 100 });
  assert.ok(w.awards.every((a) => a.playerId === "p1"));
});

test("wrapped perso : joueur inconnu → null ; joueur sans game → percentiles null", () => {
  assert.equal(computePlayerWrapped("nope", 2026, 6, inputs()), null);
  const w = computePlayerWrapped("p1", 2026, 6, inputs({ matches: games("p2", 3) }));
  assert.ok(w);
  assert.equal(w.matches, 0);
  assert.equal(w.topMap, null);
  assert.equal(w.percentiles, null);
});

test("monthRange : bornes UTC du mois, décembre inclus", () => {
  const june = monthRange(2026, 6);
  assert.equal(june.start.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(june.end.toISOString(), "2026-07-01T00:00:00.000Z");
  const dec = monthRange(2026, 12);
  assert.equal(dec.end.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("B7.10 tibia-dor / chirurgien : pire et meilleur HS%", () => {
  const awards = computeAwards(
    inputs({
      matches: [
        ...games("p1", MIN_MATCHES, { hsPercent: 20, adr: 80 }),
        ...games("p2", MIN_MATCHES, { hsPercent: 55, adr: 80 }),
      ],
    }),
  );
  const tibia = winnersOf(awards, "tibia-dor");
  assert.equal(tibia.length, 1);
  assert.equal(tibia[0]!.playerId, "p1"); // pire HS%
  assert.equal(tibia[0]!.value, 20);
  const chir = winnersOf(awards, "chirurgien");
  assert.equal(chir.length, 1);
  assert.equal(chir[0]!.playerId, "p2"); // meilleur HS%
  assert.equal(chir[0]!.value, 55);
});

test("B7.10 baby-sitter : le plus de kills en défaite", () => {
  const awards = computeAwards(
    inputs({
      matches: [
        ...games("p1", MIN_MATCHES, { kills: 30 }, { result: 0 }), // hard carry mais défaites
        ...games("p2", MIN_MATCHES, { kills: 30 }, { result: 1 }), // que des wins → 0 kill en défaite
      ],
    }),
  );
  const bs = winnersOf(awards, "baby-sitter");
  assert.equal(bs.length, 1);
  assert.equal(bs[0]!.playerId, "p1");
  assert.equal(bs[0]!.value, 30 * MIN_MATCHES);
});

test("B7.10 hamster : le plus de games pour un ΔELO ≤ 0", () => {
  const awards = computeAwards(
    inputs({
      matches: [...games("p1", MIN_MATCHES + 2), ...games("p2", MIN_MATCHES)],
      eloSnapshots: [
        { playerId: "p1", elo: 1500, capturedAt: new Date("2026-06-01T00:00:00Z") },
        { playerId: "p1", elo: 1420, capturedAt: new Date("2026-06-25T00:00:00Z") }, // -80
        { playerId: "p2", elo: 1500, capturedAt: new Date("2026-06-01T00:00:00Z") },
        { playerId: "p2", elo: 1600, capturedAt: new Date("2026-06-25T00:00:00Z") }, // +100 → exclu
      ],
    }),
  );
  const ham = winnersOf(awards, "hamster");
  assert.equal(ham.length, 1);
  assert.equal(ham[0]!.playerId, "p1"); // p2 a un ΔELO positif → écarté
  assert.equal(ham[0]!.value, MIN_MATCHES + 2);
});

test("B7.10 chatouilleur : pire ADR moyen", () => {
  const awards = computeAwards(
    inputs({
      matches: [
        ...games("p1", MIN_MATCHES, { adr: 45, hsPercent: 40 }),
        ...games("p2", MIN_MATCHES, { adr: 95, hsPercent: 40 }),
      ],
    }),
  );
  const chat = winnersOf(awards, "chatouilleur");
  assert.equal(chat.length, 1);
  assert.equal(chat[0]!.playerId, "p1");
  assert.equal(chat[0]!.value, 45);
});
