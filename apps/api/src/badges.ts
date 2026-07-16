import type { BadgeId, BadgeTier } from "@4eselo/types";
import { computeStreak } from "./streaks";

/** Badges emoji (B5.8), logique pure. Chaque règle a un seuil + une taille d'échantillon min. (évite le « 100% sur 1 game »). */

/** Match réduit aux besoins des règles (clutchs déjà sommés 1v1+1v2). */
export interface BadgeMatch {
  playedAt: Date;
  result: number; // 1 win, 0 loss
  hsPercent: number;
  entryCount: number;
  entryWins: number;
  clutchCount: number;
  clutchWins: number;
}

// Seuils ajustables (source de vérité unique).
const STREAK_MIN = 3; // 🔥 victoires consécutives
const HS_MIN_MATCHES = 10; // 🎯 matchs min. pour une moyenne fiable
const HS_RATE = 50; // % HS moyen
const ENTRY_MIN_DUELS = 20; // 💣 duels d'entrée tentés
const ENTRY_RATE = 0.55; // part d'entrées gagnées
const CLUTCH_MIN = 10; // 🧠 clutchs tentés (1v1+1v2)
const CLUTCH_RATE = 0.5; // part de clutchs gagnés
const GRIND_DAY_MATCHES = 6; // 🚿 matchs / journée (UTC)

const utcDayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

/** Badges décrochés, ordre stable (catalogue). */
export function computeBadges(matches: BadgeMatch[]): BadgeId[] {
  const badges: BadgeId[] = [];
  const n = matches.length;
  if (n === 0) return badges;

  const byDateDesc = [...matches].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());

  // 🔥 réutilise la logique de streaks (B5.5).
  const streak = computeStreak(byDateDesc.map((m) => m.result));
  if (streak.current?.type === "win" && streak.current.length >= STREAK_MIN) badges.push("streak");

  const hsAvg = matches.reduce((s, m) => s + m.hsPercent, 0) / n;
  if (n >= HS_MIN_MATCHES && hsAvg >= HS_RATE) badges.push("headshot");

  const entryWins = matches.reduce((s, m) => s + m.entryWins, 0);
  const entryCount = matches.reduce((s, m) => s + m.entryCount, 0);
  if (entryCount >= ENTRY_MIN_DUELS && entryWins / entryCount >= ENTRY_RATE) badges.push("entry");

  const clutchWins = matches.reduce((s, m) => s + m.clutchWins, 0);
  const clutchCount = matches.reduce((s, m) => s + m.clutchCount, 0);
  if (clutchCount >= CLUTCH_MIN && clutchWins / clutchCount >= CLUTCH_RATE) badges.push("clutch");

  const perDay = new Map<string, number>();
  for (const m of matches) {
    const k = utcDayKey(m.playedAt);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const maxDay = Math.max(...perDay.values());
  if (maxDay >= GRIND_DAY_MATCHES) badges.push("grind");

  return badges;
}

/**
 * Badges à paliers (B5.13). L'appelant passe les matchs DÉJÀ fenêtrés (24h
 * classement/home, 30j profil). count = nb d'émojis. Additif à computeBadges.
 */
// Paliers ajustables (cf. ROADMAP).
const STREAK_STEP = 3; // 🔥/😰 : 1 émoji / 3
const GRIND_STEP = 2; // 🚿 : 1 émoji / 2 matchs/jour, max 3
const HS_BANDS: [number, number] = [50, 60]; // 🎯 %HS → 1 puis 2 émojis
const ENTRY_BANDS: [number, number] = [55, 70]; // 💣 % duels d'entrée
const CLUTCH_BANDS: [number, number] = [50, 65]; // 🧠 % clutchs
// Min-samples relâchés (sinon jamais de badge sur 24h).
const TIER_HS_MIN = 5;
const TIER_ENTRY_MIN = 8;
const TIER_CLUTCH_MIN = 4;

/** Nb de paliers franchis (1 par seuil). */
const bandCount = (v: number, bands: readonly number[]) => bands.filter((b) => v >= b).length;

/** Fenêtre : classement = 24h, profil = 30j. */
export type BadgeScope = "today" | "month";

export function computeBadgeTiers(matches: BadgeMatch[], scope: BadgeScope): BadgeTier[] {
  const tiers: BadgeTier[] = [];
  const n = matches.length;
  if (n === 0) return tiers;

  const when = scope === "today" ? "aujourd'hui" : "ce mois-ci";

  const byDateDesc = [...matches].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  const streak = computeStreak(byDateDesc.map((m) => m.result));
  const len = streak.current?.length ?? 0;
  if (streak.current?.type === "win" && len >= STREAK_STEP) {
    tiers.push({
      id: "streak",
      emoji: "🔥",
      count: Math.floor(len / STREAK_STEP),
      message: `${len} victoires d'affilée`,
    });
  } else if (streak.current?.type === "loss" && len >= STREAK_STEP) {
    tiers.push({
      id: "coldstreak",
      emoji: "😰",
      count: Math.floor(len / STREAK_STEP),
      message: `${len} défaites d'affilée`,
    });
  }

  // 🚿 plus grosse journée (UTC)
  const perDay = new Map<string, number>();
  for (const m of matches) perDay.set(utcDayKey(m.playedAt), (perDay.get(utcDayKey(m.playedAt)) ?? 0) + 1);
  const maxDay = Math.max(...perDay.values());
  if (maxDay >= GRIND_STEP) {
    tiers.push({
      id: "grind",
      emoji: "🚿",
      count: Math.min(3, Math.floor(maxDay / GRIND_STEP)),
      message: scope === "today" ? `${maxDay} matchs aujourd'hui` : `${maxDay} matchs en 1 jour ce mois-ci`,
    });
  }

  const hsAvg = matches.reduce((s, m) => s + m.hsPercent, 0) / n;
  if (n >= TIER_HS_MIN) {
    const c = bandCount(hsAvg, HS_BANDS);
    if (c > 0)
      tiers.push({
        id: "headshot",
        emoji: "🎯",
        count: c,
        message: `${Math.round(hsAvg)}% de HS ${when}`,
      });
  }
  const eWins = matches.reduce((s, m) => s + m.entryWins, 0);
  const eCount = matches.reduce((s, m) => s + m.entryCount, 0);
  if (eCount >= TIER_ENTRY_MIN) {
    const rate = (eWins / eCount) * 100;
    const c = bandCount(rate, ENTRY_BANDS);
    if (c > 0)
      tiers.push({
        id: "entry",
        emoji: "💣",
        count: c,
        message: `${Math.round(rate)}% de duels d'entrée gagnés ${when}`,
      });
  }
  const cWins = matches.reduce((s, m) => s + m.clutchWins, 0);
  const cCount = matches.reduce((s, m) => s + m.clutchCount, 0);
  if (cCount >= TIER_CLUTCH_MIN) {
    const rate = (cWins / cCount) * 100;
    const c = bandCount(rate, CLUTCH_BANDS);
    if (c > 0)
      tiers.push({
        id: "clutch",
        emoji: "🧠",
        count: c,
        message: `${Math.round(rate)}% de clutchs gagnés ${when}`,
      });
  }

  return tiers;
}
