import type { BadgeId, BadgeTier } from "@4eselo/types";
import { computeStreak } from "./streaks";

/**
 * Badges emoji (B5.8) - logique pure, zéro I/O : les matchs arrivent en
 * paramètre, l'endpoint fait la requête. Chaque règle a un seuil documenté et
 * une taille d'échantillon minimale pour éviter le « 100 % sur 1 game ».
 */

/** Un match réduit à ce dont les règles ont besoin (clutchs déjà sommés 1v1+1v2). */
export interface BadgeMatch {
  playedAt: Date;
  result: number; // 1 win, 0 loss
  hsPercent: number;
  entryCount: number;
  entryWins: number;
  clutchCount: number;
  clutchWins: number;
}

// Seuils - ajustables ; documentés ici volontairement (source de vérité unique).
const STREAK_MIN = 3; // 🔥 victoires consécutives en cours
const HS_MIN_MATCHES = 10; // 🎯 assez de matchs pour que la moyenne veuille dire qqch
const HS_RATE = 50; // % HS moyen
const ENTRY_MIN_DUELS = 20; // 💣 duels d'entrée tentés
const ENTRY_RATE = 0.55; // part d'entrées gagnées
const CLUTCH_MIN = 10; // 🧠 clutchs tentés (1v1 + 1v2)
const CLUTCH_RATE = 0.5; // part de clutchs gagnés
const GRIND_DAY_MATCHES = 6; // 🚿 matchs sur une même journée (UTC)

const utcDayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

/** Renvoie les badges décrochés, dans un ordre stable (ordre du catalogue). */
export function computeBadges(matches: BadgeMatch[]): BadgeId[] {
  const badges: BadgeId[] = [];
  const n = matches.length;
  if (n === 0) return badges;

  const byDateDesc = [...matches].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());

  // 🔥 série de victoires en cours (réutilise la logique de streaks B5.5).
  const streak = computeStreak(byDateDesc.map((m) => m.result));
  if (streak.current?.type === "win" && streak.current.length >= STREAK_MIN) badges.push("streak");

  // 🎯 moyenne de HS% sur assez de matchs.
  const hsAvg = matches.reduce((s, m) => s + m.hsPercent, 0) / n;
  if (n >= HS_MIN_MATCHES && hsAvg >= HS_RATE) badges.push("headshot");

  // 💣 taux de duels d'entrée gagnés sur assez de tentatives.
  const entryWins = matches.reduce((s, m) => s + m.entryWins, 0);
  const entryCount = matches.reduce((s, m) => s + m.entryCount, 0);
  if (entryCount >= ENTRY_MIN_DUELS && entryWins / entryCount >= ENTRY_RATE) badges.push("entry");

  // 🧠 taux de clutchs gagnés sur assez de tentatives.
  const clutchWins = matches.reduce((s, m) => s + m.clutchWins, 0);
  const clutchCount = matches.reduce((s, m) => s + m.clutchCount, 0);
  if (clutchCount >= CLUTCH_MIN && clutchWins / clutchCount >= CLUTCH_RATE) badges.push("clutch");

  // 🚿 au moins une grosse journée de matchs.
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
 * Badges À PALIERS façon Calibrum (B5.13) - `computeBadgeTiers`.
 * L'appelant passe les matchs DÉJÀ fenêtrés (24h pour classement/home, 30j pour profil).
 * Chaque badge porte un `count` (nb d'émojis) + un `message` (tooltip). Additif : ne
 * remplace pas `computeBadges`. Seuils = premier jet, à affiner post-déploiement.
 */
// Paliers (tous ajustables - cf. ROADMAP « À revoir après déploiement »).
const STREAK_STEP = 3; // 🔥/😰 : 1 émoji par tranche de 3
const GRIND_STEP = 2; // 🚿 : 1 émoji par tranche de 2 matchs sur la journée, plafonné à 3
const HS_BANDS: [number, number] = [50, 60]; // 🎯 %HS → 1 puis 2 émojis
const ENTRY_BANDS: [number, number] = [55, 70]; // 💣 % duels d'entrée
const CLUTCH_BANDS: [number, number] = [50, 65]; // 🧠 % clutchs
// Min-samples relâchés (fenêtres courtes) - sinon jamais de badge sur 24h.
const TIER_HS_MIN = 5;
const TIER_ENTRY_MIN = 8;
const TIER_CLUTCH_MIN = 4;

/** Nb de paliers atteints selon des seuils croissants (1 par seuil franchi). */
const bandCount = (v: number, bands: readonly number[]) => bands.filter((b) => v >= b).length;

export function computeBadgeTiers(matches: BadgeMatch[]): BadgeTier[] {
  const tiers: BadgeTier[] = [];
  const n = matches.length;
  if (n === 0) return tiers;

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

  // 🚿 grind : plus grosse journée (UTC) de la fenêtre.
  const perDay = new Map<string, number>();
  for (const m of matches) perDay.set(utcDayKey(m.playedAt), (perDay.get(utcDayKey(m.playedAt)) ?? 0) + 1);
  const maxDay = Math.max(...perDay.values());
  if (maxDay >= GRIND_STEP) {
    tiers.push({
      id: "grind",
      emoji: "🚿",
      count: Math.min(3, Math.floor(maxDay / GRIND_STEP)),
      message: `${maxDay} matchs dans la journée`,
    });
  }

  // 🎯 HS%, 💣 entry, 🧠 clutch : paliers par bandes de taux (min-samples relâchés).
  const hsAvg = matches.reduce((s, m) => s + m.hsPercent, 0) / n;
  if (n >= TIER_HS_MIN) {
    const c = bandCount(hsAvg, HS_BANDS);
    if (c > 0)
      tiers.push({
        id: "headshot",
        emoji: "🎯",
        count: c,
        message: `${Math.round(hsAvg)}% de HS de moyenne`,
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
        message: `${Math.round(rate)}% de duels d'entrée gagnés`,
      });
  }
  const cWins = matches.reduce((s, m) => s + m.clutchWins, 0);
  const cCount = matches.reduce((s, m) => s + m.clutchCount, 0);
  if (cCount >= TIER_CLUTCH_MIN) {
    const rate = (cWins / cCount) * 100;
    const c = bandCount(rate, CLUTCH_BANDS);
    if (c > 0)
      tiers.push({ id: "clutch", emoji: "🧠", count: c, message: `${Math.round(rate)}% de clutchs gagnés` });
  }

  return tiers;
}
