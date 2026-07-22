import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMatchStats, type DeathEvent } from "./demoStats";

const ME = "76561198249791904";
const OPP = "99999999999999999";

const death = (o: Partial<DeathEvent>): DeathEvent => ({
  attacker_steamid: ME,
  user_steamid: OPP,
  assister_steamid: null,
  headshot: false,
  total_rounds_played: 0,
  tick: 1,
  ...o,
});

test("kills / deaths / assists / HS% de base", () => {
  const s = computeMatchStats({
    steamId64: ME,
    rounds: 20,
    deaths: [
      death({ headshot: true }),
      death({ total_rounds_played: 1 }),
      death({ attacker_steamid: OPP, user_steamid: ME, total_rounds_played: 1 }), // je meurs
      death({ attacker_steamid: OPP, user_steamid: "third", assister_steamid: ME, total_rounds_played: 2 }), // assist
    ],
    hurts: [],
    mvps: [],
  });
  assert.equal(s.kills, 2);
  assert.equal(s.deaths, 1);
  assert.equal(s.assists, 1);
  assert.equal(s.hsPercent, 50); // 1 HS / 2 kills
  assert.equal(s.kd, 2);
});

test("ADR + utility damage à partir de player_hurt", () => {
  const s = computeMatchStats({
    steamId64: ME,
    rounds: 10,
    deaths: [],
    hurts: [
      { attacker_steamid: ME, user_steamid: OPP, dmg_health: 100, weapon: "ak47" },
      { attacker_steamid: ME, user_steamid: OPP, dmg_health: 40, weapon: "hegrenade" },
      { attacker_steamid: ME, user_steamid: ME, dmg_health: 20, weapon: "inferno" }, // self → ignoré
      { attacker_steamid: OPP, user_steamid: ME, dmg_health: 50, weapon: "ak47" }, // pas moi
    ],
    mvps: [],
  });
  assert.equal(s.damage, 140);
  assert.equal(s.adr, 14); // 140 / 10
  assert.equal(s.utilityDamage, 40);
});

test("multi-kills groupés par round", () => {
  const kill = (round: number) => death({ total_rounds_played: round });
  const s = computeMatchStats({
    steamId64: ME,
    rounds: 5,
    deaths: [kill(0), kill(0), kill(0), kill(1), kill(1), kill(2)], // triple, double, solo
    hurts: [],
    mvps: [],
  });
  assert.equal(s.tripleKills, 1);
  assert.equal(s.doubleKills, 1);
  assert.equal(s.quadroKills, 0);
  assert.equal(s.kills, 6);
});

test("entry : 1er kill / 1re mort du round", () => {
  const s = computeMatchStats({
    steamId64: ME,
    rounds: 2,
    deaths: [
      death({ total_rounds_played: 0, tick: 100 }), // mon 1er kill du round 0 → firstKill
      death({ total_rounds_played: 0, tick: 200 }),
      death({ attacker_steamid: OPP, user_steamid: ME, total_rounds_played: 1, tick: 50 }), // 1re action round 1 = ma mort
      death({ total_rounds_played: 1, tick: 300 }),
    ],
    hurts: [],
    mvps: [],
  });
  assert.equal(s.firstKills, 1);
  assert.equal(s.firstDeaths, 1);
});

test("MVP compté pour le membre uniquement", () => {
  const s = computeMatchStats({
    steamId64: ME,
    rounds: 3,
    deaths: [],
    hurts: [],
    mvps: [{ user_steamid: ME }, { user_steamid: OPP }, { user_steamid: ME }],
  });
  assert.equal(s.mvps, 2);
});
