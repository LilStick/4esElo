import type { PremierMatchStats } from "@4eselo/types";

/**
 * Calcul des stats d'un match Premier depuis les events de la démo (B18.14).
 * Pur, testable : prend les tableaux d'events déjà parsés (player_death /
 * player_hurt / round_mvp) + le nombre de rounds, sort les stats du membre.
 */

export interface DeathEvent {
  attacker_steamid?: string | number | null;
  user_steamid?: string | number | null;
  assister_steamid?: string | number | null;
  headshot?: boolean | null;
  total_rounds_played?: number | null;
  tick: number;
}
export interface HurtEvent {
  attacker_steamid?: string | number | null;
  user_steamid?: string | number | null;
  dmg_health?: number | null;
  weapon?: string | null;
}
export interface MvpEvent {
  user_steamid?: string | number | null;
}

export interface MatchStatsInput {
  steamId64: string;
  rounds: number;
  deaths: DeathEvent[];
  hurts: HurtEvent[];
  mvps: MvpEvent[];
}

/** Armes de utility comptées pour l'utility damage (dégâts HE + molotov/incendiaire). */
const UTILITY_WEAPONS = new Set(["hegrenade", "inferno", "molotov", "firebomb", "incgrenade"]);

const sid = (v: string | number | null | undefined): string => (v == null ? "" : String(v));
const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;

export function computeMatchStats(input: MatchStatsInput): PremierMatchStats {
  const me = String(input.steamId64);
  const rounds = Math.max(0, input.rounds);

  // Un kill = j'ai tué quelqu'un d'autre (on ignore les self-kills type chute/bombe).
  const myKills = input.deaths.filter((d) => sid(d.attacker_steamid) === me && sid(d.user_steamid) !== me);
  const kills = myKills.length;
  const deaths = input.deaths.filter((d) => sid(d.user_steamid) === me).length;
  const assists = input.deaths.filter(
    (d) => sid(d.assister_steamid) === me && sid(d.user_steamid) !== me,
  ).length;
  const headshots = myKills.filter((d) => d.headshot).length;

  const myDamage = input.hurts.filter((h) => sid(h.attacker_steamid) === me && sid(h.user_steamid) !== me);
  const damage = myDamage.reduce((s, h) => s + (h.dmg_health ?? 0), 0);
  const utilityDamage = myDamage
    .filter((h) => UTILITY_WEAPONS.has(h.weapon ?? ""))
    .reduce((s, h) => s + (h.dmg_health ?? 0), 0);

  const mvps = input.mvps.filter((m) => sid(m.user_steamid) === me).length;

  // Multi-kills : nombre de kills par round.
  const killsByRound = new Map<number, number>();
  for (const d of myKills) {
    const r = d.total_rounds_played ?? -1;
    killsByRound.set(r, (killsByRound.get(r) ?? 0) + 1);
  }
  let doubleKills = 0;
  let tripleKills = 0;
  let quadroKills = 0;
  let pentaKills = 0;
  for (const c of killsByRound.values()) {
    if (c === 2) doubleKills++;
    else if (c === 3) tripleKills++;
    else if (c === 4) quadroKills++;
    else if (c >= 5) pentaKills++;
  }

  // Entry : 1er kill (et 1re mort) de chaque round.
  const firstByRound = new Map<number, DeathEvent>();
  for (const d of [...input.deaths].sort((a, b) => a.tick - b.tick)) {
    const r = d.total_rounds_played ?? -1;
    if (!firstByRound.has(r)) firstByRound.set(r, d);
  }
  let firstKills = 0;
  let firstDeaths = 0;
  for (const d of firstByRound.values()) {
    if (sid(d.attacker_steamid) === me && sid(d.user_steamid) !== me) firstKills++;
    if (sid(d.user_steamid) === me) firstDeaths++;
  }

  return {
    kills,
    deaths,
    assists,
    kd: r2(deaths ? kills / deaths : kills),
    kr: r2(rounds ? kills / rounds : 0),
    adr: r1(rounds ? damage / rounds : 0),
    damage,
    hsPercent: r1(kills ? (headshots / kills) * 100 : 0),
    rounds,
    mvps,
    doubleKills,
    tripleKills,
    quadroKills,
    pentaKills,
    firstKills,
    firstDeaths,
    utilityDamage,
  };
}
