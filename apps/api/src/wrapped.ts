import type {
  AwardKey,
  AwardWinner,
  FaceitMatchStats,
  PlayerBigWrappedResponse,
  PlayerWrappedResponse,
  WrappedPercentiles,
} from "@4eselo/types";

/**
 * Moteur d'awards du Wrapped mensuel (B7.2) — fonctions pures, zéro I/O.
 * Les 9 awards votés par l'asso, calculés depuis les matchs, snapshots ELO
 * et snapshots de playtime du mois. Ex æquo : tous les gagnants sont émis.
 */

export interface WrappedPlayer {
  id: string;
  nickname: string;
  discordId: string | null;
  discordAvatar: string | null;
}

export interface WrappedMatch {
  playerId: string;
  map: string;
  playedAt: Date;
  result: number; // 1 win, 0 loss
  stats: FaceitMatchStats;
}

export interface WrappedEloSnapshot {
  playerId: string;
  elo: number;
  capturedAt: Date;
}

export interface WrappedPlaytimeSnapshot {
  playerId: string;
  /** null = heures privées côté Steam. */
  minutesForever: number | null;
  capturedAt: Date;
}

export interface WrappedInputs {
  players: WrappedPlayer[];
  /** Matchs du mois uniquement (filtrés en amont). */
  matches: WrappedMatch[];
  /** Snapshots ELO du mois uniquement. */
  eloSnapshots: WrappedEloSnapshot[];
  /** Snapshots de playtime du mois uniquement. */
  playtimeSnapshots: WrappedPlaytimeSnapshot[];
}

/** Minimum de games sur le mois pour être éligible (sauf 👻 Fantôme). */
export const MIN_MATCHES = 5;
/** Minimum de situations de clutch (1v1+1v2) pour le 🧠. */
export const MIN_CLUTCH_ATTEMPTS = 5;
/** 🧀 Puant : part minimale des games sur sa top map + winrate minimal dessus. */
export const ONE_TRICK_MIN_SHARE = 0.4;
export const ONE_TRICK_MIN_WINRATE = 50;

export const AWARD_META: Record<AwardKey, { emoji: string; title: string }> = {
  rat: { emoji: "🐀", title: "Rat" },
  spammeur: { emoji: "💨", title: "Spammeur" },
  puant: { emoji: "🧀", title: "Puant" },
  "chute-libre": { emoji: "📉", title: "Chute libre" },
  tryharder: { emoji: "🔥", title: "Tryharder" },
  "ministre-du-clutch": { emoji: "🧠", title: "Ministre du Clutch" },
  nolife: { emoji: "🌙", title: "Nolife" },
  "abonne-absent": { emoji: "⏰", title: "Abonné absent" },
  fantome: { emoji: "👻", title: "Fantôme" },
  // Prix roast (B7.10)
  "tibia-dor": { emoji: "🦵", title: "Tibia d'or" },
  chirurgien: { emoji: "🎯", title: "Chirurgien" },
  "baby-sitter": { emoji: "🚑", title: "Baby-sitter" },
  hamster: { emoji: "🐹", title: "Hamster" },
  chatouilleur: { emoji: "🪶", title: "Chatouilleur" },
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (num: number, den: number) => (den > 0 ? round1((num / den) * 100) : 0);

/** [début, fin) du mois en UTC — le décalage Paris aux bornes est négligeable à l'échelle d'un mois. */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

/**
 * [début, fin) UTC d'une période longue (B7.12) : `"2026"` (année entière) ou
 * `"2026-H1"` / `"2026-H2"` (semestre). Renvoie null si le format est invalide.
 */
export function periodRange(period: string): { start: Date; end: Date } | null {
  const year = /^(\d{4})$/.exec(period);
  if (year) {
    const y = Number(year[1]);
    return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) };
  }
  const semester = /^(\d{4})-H([12])$/.exec(period);
  if (semester) {
    const y = Number(semester[1]);
    const startMonth = semester[2] === "1" ? 0 : 6;
    return {
      start: new Date(Date.UTC(y, startMonth, 1)),
      end: new Date(Date.UTC(y, startMonth + 6, 1)), // H2 : mois 12 → 1er janvier N+1
    };
  }
  return null;
}

/**
 * Libellé de fenêtre injecté dans les punchlines des awards.
 * Mensuel → "ce mois-ci" ; BIG Wrapped → "cette année" (YYYY) ou "ce semestre" (YYYY-H1/H2).
 * `period` est déjà validé par `periodRange` en amont.
 */
export const MONTHLY_LABEL = "ce mois-ci";
export function periodLabel(period: string): string {
  return /^\d{4}$/.test(period) ? "cette année" : "ce semestre";
}

const parisHourFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  hour12: false,
});
/** Heure locale Paris (0-23) — pour le 🌙 les games se jouent en heure française. */
export function parisHour(d: Date): number {
  const hour = parisHourFmt.formatToParts(d).find((p) => p.type === "hour")!.value;
  return Number(hour) % 24; // hour12:false peut rendre "24" à minuit selon l'ICU
}
/** Game de nolife : commencée entre 1h et 7h du matin, heure de Paris. */
const isLateNight = (d: Date) => {
  const h = parisHour(d);
  return h >= 1 && h < 7;
};

interface PlayerMonth {
  player: WrappedPlayer;
  matches: WrappedMatch[];
}

function groupByPlayer(inputs: WrappedInputs): PlayerMonth[] {
  const byId = new Map<string, WrappedMatch[]>();
  for (const m of inputs.matches) {
    const list = byId.get(m.playerId) ?? [];
    list.push(m);
    byId.set(m.playerId, list);
  }
  return inputs.players.map((player) => ({ player, matches: byId.get(player.id) ?? [] }));
}

const avg = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Évolution d'ELO du mois par joueur : dernier snapshot − premier (≥ 2 requis). */
function eloDeltas(snapshots: WrappedEloSnapshot[]): Map<string, { start: number; end: number }> {
  const byPlayer = new Map<string, WrappedEloSnapshot[]>();
  for (const s of snapshots) {
    const list = byPlayer.get(s.playerId) ?? [];
    list.push(s);
    byPlayer.set(s.playerId, list);
  }
  const out = new Map<string, { start: number; end: number }>();
  for (const [playerId, list] of byPlayer) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    out.set(playerId, { start: sorted[0]!.elo, end: sorted[sorted.length - 1]!.elo });
  }
  return out;
}

/** Minutes jouées sur le mois : dernier échantillon lisible − premier (≥ 2 requis). */
function monthlyPlaytime(snapshots: WrappedPlaytimeSnapshot[]): Map<string, number> {
  const byPlayer = new Map<string, WrappedPlaytimeSnapshot[]>();
  for (const s of snapshots) {
    if (s.minutesForever === null) continue;
    const list = byPlayer.get(s.playerId) ?? [];
    list.push(s);
    byPlayer.set(s.playerId, list);
  }
  const out = new Map<string, number>();
  for (const [playerId, list] of byPlayer) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    out.set(playerId, Math.max(0, sorted[sorted.length - 1]!.minutesForever! - sorted[0]!.minutesForever!));
  }
  return out;
}

interface Candidate {
  player: WrappedPlayer;
  value: number;
  punchline: string;
  /** Départage avant l'ex æquo (plus grand = mieux placé). */
  tiebreak?: number;
}

/** Garde les meilleurs candidats (score max, départage, ex æquo conservés) et fabrique les AwardWinner. */
function pickWinners(award: AwardKey, candidates: Candidate[]): AwardWinner[] {
  if (candidates.length === 0) return [];
  const best = Math.max(...candidates.map((c) => c.value));
  let top = candidates.filter((c) => c.value === best);
  const bestTie = Math.max(...top.map((c) => c.tiebreak ?? 0));
  top = top.filter((c) => (c.tiebreak ?? 0) === bestTie);
  const { emoji, title } = AWARD_META[award];
  return top
    .sort((a, b) => a.player.nickname.localeCompare(b.player.nickname))
    .map((c) => ({
      award,
      emoji,
      title,
      playerId: c.player.id,
      nickname: c.player.nickname,
      discordId: c.player.discordId,
      discordAvatar: c.player.discordAvatar,
      value: c.value,
      punchline: c.punchline,
    }));
}

/** 🐀 Rat : beaucoup de frags, peu d'entrys — il attend son heure au fond. */
function rat(pool: PlayerMonth[]): AwardWinner[] {
  const eligible = pool.filter((p) => p.matches.length >= MIN_MATCHES);
  if (eligible.length === 0) return [];
  const entryAvgs = eligible.map((p) => avg(p.matches.map((m) => m.stats.entryCount)));
  const entryMedian = median(entryAvgs);
  const candidates = eligible
    .filter((_, i) => entryAvgs[i]! <= entryMedian)
    .map((p) => {
      const kills = round1(avg(p.matches.map((m) => m.stats.kills)));
      const entries = round1(avg(p.matches.map((m) => m.stats.entryCount)));
      return {
        player: p.player,
        value: kills,
        tiebreak: -entries,
        punchline: `${kills} frags/game mais ${entries} entry/game — il fragge depuis les fourrés.`,
      };
    });
  return pickWinners("rat", candidates);
}

/** 💨 Spammeur : le plus de flashs + utility par game. */
function spammeur(pool: PlayerMonth[]): AwardWinner[] {
  const candidates = pool
    .filter((p) => p.matches.length >= MIN_MATCHES)
    .map((p) => {
      const perGame = round1(avg(p.matches.map((m) => m.stats.flashCount + m.stats.utilityCount)));
      return {
        player: p.player,
        value: perGame,
        punchline: `${perGame} grenades/game — personne ne voit plus rien.`,
      };
    })
    .filter((c) => c.value > 0);
  return pickWinners("spammeur", candidates);
}

/** 🧀 Puant : one-trick qui win — presque que sa map, et il la gagne. */
function puant(pool: PlayerMonth[]): AwardWinner[] {
  const candidates: Candidate[] = [];
  for (const p of pool) {
    if (p.matches.length < MIN_MATCHES) continue;
    const byMap = new Map<string, WrappedMatch[]>();
    for (const m of p.matches) {
      const list = byMap.get(m.map) ?? [];
      list.push(m);
      byMap.set(m.map, list);
    }
    const [topMap, list] = [...byMap.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    )[0]!;
    const share = list.length / p.matches.length;
    const winRate = pct(
      list.reduce((s, m) => s + m.result, 0),
      list.length,
    );
    if (share < ONE_TRICK_MIN_SHARE || winRate < ONE_TRICK_MIN_WINRATE) continue;
    candidates.push({
      player: p.player,
      value: round1(share * winRate),
      punchline: `${Math.round(share * 100)}% de ses games sur ${topMap}, ${winRate}% de wins — ça sent le renfermé.`,
    });
  }
  return pickWinners("puant", candidates);
}

/** 📉 Chute libre : pire ΔELO du mois (négatif obligatoire). */
function chuteLibre(
  pool: PlayerMonth[],
  deltas: Map<string, { start: number; end: number }>,
  label: string,
): AwardWinner[] {
  const candidates: Candidate[] = [];
  for (const p of pool) {
    const d = deltas.get(p.player.id);
    if (!d) continue;
    const delta = d.end - d.start;
    if (delta >= 0) continue;
    candidates.push({
      player: p.player,
      // pickWinners prend le max → on inverse pour garder la pire chute, value réelle dans la punchline.
      value: -delta,
      punchline: `${delta} ELO ${label} (${d.start} → ${d.end}) — pensez à lui.`,
    });
  }
  return pickWinners("chute-libre", candidates).map((w) => ({ ...w, value: -w.value }));
}

/** 🔥 Tryharder : le plus de games. */
function tryharder(pool: PlayerMonth[], label: string): AwardWinner[] {
  const candidates = pool
    .filter((p) => p.matches.length >= MIN_MATCHES)
    .map((p) => ({
      player: p.player,
      value: p.matches.length,
      punchline: `${p.matches.length} games ${label} — le grind ne s'arrête jamais.`,
    }));
  return pickWinners("tryharder", candidates);
}

/** 🧠 Ministre du Clutch : meilleur winrate de clutch (1v1+1v2), min. d'occasions requis. */
function ministreDuClutch(pool: PlayerMonth[]): AwardWinner[] {
  const candidates: Candidate[] = [];
  for (const p of pool) {
    if (p.matches.length < MIN_MATCHES) continue;
    const attempts = p.matches.reduce((s, m) => s + m.stats.clutch1v1Count + m.stats.clutch1v2Count, 0);
    if (attempts < MIN_CLUTCH_ATTEMPTS) continue;
    const wins = p.matches.reduce((s, m) => s + m.stats.clutch1v1Wins + m.stats.clutch1v2Wins, 0);
    const rate = pct(wins, attempts);
    candidates.push({
      player: p.player,
      value: rate,
      tiebreak: attempts,
      punchline: `${wins}/${attempts} clutchs gagnés (${rate}%) — calme olympien.`,
    });
  }
  return pickWinners("ministre-du-clutch", candidates);
}

/** 🌙 Nolife : le plus de games lancées entre 1h et 7h du matin (heure de Paris). */
function nolife(pool: PlayerMonth[]): AwardWinner[] {
  const candidates = pool
    .filter((p) => p.matches.length >= MIN_MATCHES)
    .map((p) => {
      const lateGames = p.matches.filter((m) => isLateNight(m.playedAt)).length;
      return {
        player: p.player,
        value: lateGames,
        punchline: `${lateGames} games après 1h du mat' — le soleil est optionnel.`,
      };
    })
    .filter((c) => c.value > 0);
  return pickWinners("nolife", candidates);
}

/** ⏰ Abonné absent : le moins de minutes CS2 jouées sur le mois (playtime Steam lisible requis). */
function abonneAbsent(pool: PlayerMonth[], playtimes: Map<string, number>, label: string): AwardWinner[] {
  const candidates: Candidate[] = [];
  for (const p of pool) {
    const minutes = playtimes.get(p.player.id);
    if (minutes === undefined) continue;
    const hours = round1(minutes / 60);
    candidates.push({
      player: p.player,
      // Le moins de playtime gagne → inversion pour pickWinners (max), value réelle restaurée après.
      value: -minutes,
      punchline: `${hours} h de CS2 ${label} — l'abonnement tourne à vide.`,
    });
  }
  return pickWinners("abonne-absent", candidates).map((w) => ({ ...w, value: -w.value }));
}

/** 👻 Fantôme : zéro game sur le mois — dispensé du minimum de games, évidemment. */
function fantome(pool: PlayerMonth[], label: string): AwardWinner[] {
  const candidates = pool
    .filter((p) => p.matches.length === 0)
    .map((p) => ({
      player: p.player,
      value: 0,
      punchline: `0 game ${label} — vu pour la dernière fois il y a longtemps.`,
    }));
  // Un fantôme n'est un fantôme que si le pôle, lui, a joué.
  if (candidates.length === pool.length) return [];
  return pickWinners("fantome", candidates);
}

// --- Prix roast (B7.10) — validés en features-talk. ---

/** 🦵 Tibia d'or : pire HS% moyen du mois. */
function tibiaDor(pool: PlayerMonth[], label: string): AwardWinner[] {
  const candidates = pool
    .filter((p) => p.matches.length >= MIN_MATCHES)
    .map((p) => {
      const hs = round1(avg(p.matches.map((m) => m.stats.hsPercent)));
      // Le plus bas gagne → inversion pour pickWinners (max), value réelle restaurée après.
      return { player: p.player, value: -hs, punchline: `${hs}% de HS ${label} — tu vises les chevilles.` };
    });
  return pickWinners("tibia-dor", candidates).map((w) => ({ ...w, value: -w.value }));
}

/** 🎯 Chirurgien : meilleur HS% moyen. */
function chirurgien(pool: PlayerMonth[]): AwardWinner[] {
  const candidates = pool
    .filter((p) => p.matches.length >= MIN_MATCHES)
    .map((p) => {
      const hs = round1(avg(p.matches.map((m) => m.stats.hsPercent)));
      return { player: p.player, value: hs, punchline: `${hs}% de HS — les casques ne servent plus à rien.` };
    })
    .filter((c) => c.value > 0);
  return pickWinners("chirurgien", candidates);
}

/** 🚑 Baby-sitter : le plus de kills cumulés en défaite (gros carry, équipe aux abonnés absents). */
function babySitter(pool: PlayerMonth[]): AwardWinner[] {
  const candidates = pool
    .filter((p) => p.matches.length >= MIN_MATCHES)
    .map((p) => {
      const kills = p.matches.filter((m) => m.result === 0).reduce((s, m) => s + m.stats.kills, 0);
      return {
        player: p.player,
        value: kills,
        punchline: `${kills} kills en défaite — mal entouré, le poto.`,
      };
    })
    .filter((c) => c.value > 0);
  return pickWinners("baby-sitter", candidates);
}

/** 🐹 Hamster : le plus de games pour un ΔELO ≤ 0 (le grind qui ne rapporte rien). */
function hamster(pool: PlayerMonth[], deltas: Map<string, { start: number; end: number }>): AwardWinner[] {
  const candidates: Candidate[] = [];
  for (const p of pool) {
    if (p.matches.length < MIN_MATCHES) continue;
    const d = deltas.get(p.player.id);
    if (!d) continue;
    const delta = d.end - d.start;
    if (delta > 0) continue; // il faut que le grind n'ait rien rapporté
    candidates.push({
      player: p.player,
      value: p.matches.length,
      tiebreak: -delta,
      punchline: `${p.matches.length} games pour ${delta} ELO — la roue tourne dans le vide.`,
    });
  }
  return pickWinners("hamster", candidates);
}

/** 🪶 Chatouilleur : pire ADR moyen du mois. */
function chatouilleur(pool: PlayerMonth[], label: string): AwardWinner[] {
  const candidates = pool
    .filter((p) => p.matches.length >= MIN_MATCHES)
    .map((p) => {
      const adr = round1(avg(p.matches.map((m) => m.stats.adr)));
      return {
        player: p.player,
        value: -adr,
        punchline: `${adr} d'ADR ${label} — tu distribues des caresses.`,
      };
    })
    .filter((c) => c.value < 0); // adr > 0 (données présentes)
  return pickWinners("chatouilleur", candidates).map((w) => ({ ...w, value: -w.value }));
}

/**
 * Calcule les 14 awards de la fenêtre (9 originaux + 5 roast B7.10). Liste vide si personne d'éligible.
 * `label` = libellé de période inséré dans les punchlines ("ce mois-ci" par défaut ;
 * "cette année"/"ce semestre" pour un BIG Wrapped, cf. `periodLabel`).
 */
export function computeAwards(inputs: WrappedInputs, label: string = MONTHLY_LABEL): AwardWinner[] {
  const pool = groupByPlayer(inputs);
  const deltas = eloDeltas(inputs.eloSnapshots);
  const playtimes = monthlyPlaytime(inputs.playtimeSnapshots);
  return [
    ...rat(pool),
    ...spammeur(pool),
    ...puant(pool),
    ...chuteLibre(pool, deltas, label),
    ...tryharder(pool, label),
    ...ministreDuClutch(pool),
    ...nolife(pool),
    ...abonneAbsent(pool, playtimes, label),
    ...fantome(pool, label),
    ...tibiaDor(pool, label),
    ...chirurgien(pool),
    ...babySitter(pool),
    ...hamster(pool, deltas),
    ...chatouilleur(pool, label),
  ];
}

/** Percentile 0-100 : part des joueurs actifs du mois dont la valeur est ≤ à la sienne. */
function percentile(value: number, all: number[]): number {
  if (all.length === 0) return 0;
  return Math.round((all.filter((v) => v <= value).length / all.length) * 100);
}

/** Cœur du Wrapped perso (sans l'étiquette de période) — partagé mensuel / BIG (B7.12). */
type PlayerWrappedCore = Omit<PlayerWrappedResponse, "year" | "month">;

function computePlayerWrappedCore(
  playerId: string,
  inputs: WrappedInputs,
  label: string = MONTHLY_LABEL,
): PlayerWrappedCore | null {
  const player = inputs.players.find((p) => p.id === playerId);
  if (!player) return null;

  const pool = groupByPlayer(inputs);
  const mine = pool.find((p) => p.player.id === playerId)!;
  const matches = mine.matches;
  const wins = matches.reduce((s, m) => s + m.result, 0);

  let topMap: PlayerWrappedResponse["topMap"] = null;
  if (matches.length > 0) {
    const byMap = new Map<string, WrappedMatch[]>();
    for (const m of matches) {
      const list = byMap.get(m.map) ?? [];
      list.push(m);
      byMap.set(m.map, list);
    }
    const [map, list] = [...byMap.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    )[0]!;
    topMap = {
      map,
      matches: list.length,
      winRate: pct(
        list.reduce((s, m) => s + m.result, 0),
        list.length,
      ),
    };
  }

  const d = eloDeltas(inputs.eloSnapshots).get(playerId);
  const playtime = monthlyPlaytime(inputs.playtimeSnapshots).get(playerId);

  // Percentiles vs les joueurs actifs du mois (au moins 1 game), joueur inclus.
  let percentiles: WrappedPercentiles | null = null;
  const active = pool.filter((p) => p.matches.length > 0);
  if (matches.length > 0) {
    const of = (fn: (p: PlayerMonth) => number) => {
      return percentile(fn(mine), active.map(fn));
    };
    percentiles = {
      matches: of((p) => p.matches.length),
      winRate: of((p) =>
        pct(
          p.matches.reduce((s, m) => s + m.result, 0),
          p.matches.length,
        ),
      ),
      kd: of((p) => {
        const kills = p.matches.reduce((s, m) => s + m.stats.kills, 0);
        const deaths = p.matches.reduce((s, m) => s + m.stats.deaths, 0);
        return deaths > 0 ? kills / deaths : kills;
      }),
      adr: of((p) => avg(p.matches.map((m) => m.stats.adr))),
    };
  }

  return {
    playerId,
    nickname: player.nickname,
    discordId: player.discordId,
    discordAvatar: player.discordAvatar,
    matches: matches.length,
    wins,
    winRate: pct(wins, matches.length),
    topMap,
    playtimeMinutes: playtime ?? null,
    elo: d ? { start: d.start, end: d.end, delta: d.end - d.start } : null,
    percentiles,
    awards: computeAwards(inputs, label).filter((a) => a.playerId === playerId),
  };
}

/** Wrapped perso d'un mois (B7.2) : le cœur + l'étiquette année/mois. */
export function computePlayerWrapped(
  playerId: string,
  year: number,
  month: number,
  inputs: WrappedInputs,
): PlayerWrappedResponse | null {
  const core = computePlayerWrappedCore(playerId, inputs);
  return core ? { year, month, ...core } : null;
}

/** Wrapped perso d'une période longue (B7.12) : le cœur + l'étiquette de période. */
export function computePlayerBigWrapped(
  playerId: string,
  period: string,
  inputs: WrappedInputs,
): PlayerBigWrappedResponse | null {
  const core = computePlayerWrappedCore(playerId, inputs, periodLabel(period));
  return core ? { period, ...core } : null;
}
