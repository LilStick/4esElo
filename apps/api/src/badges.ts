import type { BadgeId } from "@4eselo/types";
import { computeStreak } from "./streaks";

/**
 * Badges emoji (B5.8) — logique pure, zéro I/O : les matchs arrivent en
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

// Seuils — ajustables ; documentés ici volontairement (source de vérité unique).
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
