import type { RoastForecast, RoastLine } from "@4eselo/types";

/**
 * Roast niveau profil + forecast ELO (B7.6) — logique pure, zéro I/O, zéro IA.
 * Deux couches : des punchlines "extrêmes" (les plus croustillantes, conditionnelles)
 * + des lignes "toujours là" (tier de KD, map de prédilection) pour garantir qu'un
 * membre actif déclenche ≥ 2 lignes. Le roast par-match vit dans `@4eselo/types`.
 */

export interface RoastProfileInput {
  matches: number;
  avgHs: number; // % moyen
  kd: number;
  adr: number;
  clutchAttempts: number;
  clutchWinRate: number; // 0-100
  entryAttempts: number;
  entrySuccessRate: number; // 0-100
  /** Longueur de la série de victoires en cours (0 si la dernière est une défaite). */
  currentWinStreak: number;
  /** ΔELO sur ~30 j, null si inconnu. */
  eloDelta30d: number | null;
  /** Pire map (≥ min games), null si aucune. */
  worstMap: { map: string; winRate: number; matches: number } | null;
  /** Map la plus jouée, null si aucune. */
  topMap: { map: string; winRate: number; matches: number } | null;
}

/** Assez de games pour que les tendances veuillent dire quelque chose. */
const MIN_MATCHES = 10;
/** Actif : en dessous, on ne force pas les lignes "toujours là". */
const MIN_ACTIVE = 5;

const r0 = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);

interface Rule {
  prio: number;
  when: (i: RoastProfileInput) => boolean;
  line: (i: RoastProfileInput) => RoastLine;
}

/** Punchlines conditionnelles — les traits marquants (les vraies vannes). */
const EXTREMES: Rule[] = [
  {
    prio: 100,
    when: (i) => (i.eloDelta30d ?? 0) <= -100,
    line: (i) => ({
      emoji: "📉",
      label: "Chute libre",
      text: `${i.eloDelta30d} ELO ce mois — la gravité te réclame.`,
    }),
  },
  {
    prio: 90,
    when: (i) => (i.eloDelta30d ?? 0) >= 100,
    line: (i) => ({ emoji: "🚀", label: "Ascension", text: `+${i.eloDelta30d} ELO ce mois — ça décolle.` }),
  },
  {
    prio: 85,
    when: (i) => i.matches >= 30 && (i.eloDelta30d ?? 1) <= 0,
    line: (i) => ({
      emoji: "🐹",
      label: "Hamster",
      text: `${i.matches} games pour ${i.eloDelta30d ?? 0} ELO — la roue tourne dans le vide.`,
    }),
  },
  {
    prio: 80,
    when: (i) => i.currentWinStreak >= 3,
    line: (i) => ({
      emoji: "🔥",
      label: "En feu",
      text: `${i.currentWinStreak} victoires d'affilée — laisse-en aux autres.`,
    }),
  },
  {
    prio: 75,
    when: (i) => !!i.worstMap && i.worstMap.matches >= 5 && i.worstMap.winRate <= 25,
    line: (i) => ({
      emoji: "🗺️",
      label: "Map maudite",
      text: `${i.worstMap!.winRate}% sur ${i.worstMap!.map} — bannis-la de ta vie.`,
    }),
  },
  {
    prio: 70,
    when: (i) => i.matches >= MIN_MATCHES && i.avgHs < 38,
    line: (i) => ({
      emoji: "🦵",
      label: "Chasseur de tibias",
      text: `${r0(i.avgHs)}% de HS — tu vises les chevilles.`,
    }),
  },
  {
    prio: 70,
    when: (i) => i.matches >= MIN_MATCHES && i.avgHs >= 53,
    line: (i) => ({
      emoji: "🎯",
      label: "Chirurgien",
      text: `${r0(i.avgHs)}% de HS — les casques ne servent plus.`,
    }),
  },
  {
    prio: 65,
    when: (i) => i.entryAttempts >= 20 && i.entrySuccessRate < 38,
    line: (i) => ({
      emoji: "💣",
      label: "Chair à canon",
      text: `${r0(i.entrySuccessRate)}% de duels d'entrée — premier au cimetière.`,
    }),
  },
  {
    prio: 65,
    when: (i) => i.clutchAttempts >= 10 && i.clutchWinRate >= 52,
    line: (i) => ({
      emoji: "🧊",
      label: "Sang-froid",
      text: `${r0(i.clutchWinRate)}% de clutchs gagnés — nerfs d'acier.`,
    }),
  },
  {
    prio: 55,
    when: (i) => i.matches >= MIN_MATCHES && i.adr < 62,
    line: (i) => ({
      emoji: "🪶",
      label: "Chatouilleur",
      text: `${r0(i.adr)} d'ADR — tu distribues des caresses.`,
    }),
  },
  {
    prio: 55,
    when: (i) => i.matches >= MIN_MATCHES && i.adr >= 90,
    line: (i) => ({ emoji: "💥", label: "Gros bras", text: `${r0(i.adr)} d'ADR — ça fait très mal.` }),
  },
];

/** Tier de KD — une ligne toujours émise pour un joueur actif. */
function kdTierLine(i: RoastProfileInput): RoastLine {
  if (i.kd >= 1.25) return { emoji: "🔫", label: "Boucher", text: `KD ${round1(i.kd)} — machine à frags.` };
  if (i.kd <= 0.85)
    return {
      emoji: "🧟",
      label: "Aide-soignant",
      text: `KD ${round1(i.kd)} — surtout là pour le soutien moral.`,
    };
  return { emoji: "⚔️", label: "Soldat", text: `KD ${round1(i.kd)} — ni héros ni boulet.` };
}

function topMapLine(i: RoastProfileInput): RoastLine {
  const m = i.topMap!;
  const share = r0((m.matches / Math.max(1, i.matches)) * 100);
  return {
    emoji: "🗺️",
    label: "Map de prédilection",
    text: `${share}% de tes games sur ${m.map} (${m.winRate}% de win).`,
  };
}

/** Les meilleures punchlines profil (croustillantes d'abord). Actif → ≥ 2 lignes garanties. */
export function profileRoast(input: RoastProfileInput, limit = 3): RoastLine[] {
  const scored = EXTREMES.filter((r) => r.when(input)).map((r) => ({ prio: r.prio, line: r.line(input) }));
  if (input.matches >= MIN_ACTIVE) {
    scored.push({ prio: 45, line: kdTierLine(input) });
    if (input.topMap) scored.push({ prio: 40, line: topMapLine(input) });
  }
  return scored
    .sort((a, b) => b.prio - a.prio)
    .slice(0, limit)
    .map((s) => s.line);
}

/** Forecast ELO : régression linéaire sur les snapshots des 30 derniers jours. */
export function forecastElo(points: { elo: number; capturedAt: Date }[], now: Date): RoastForecast | null {
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const recent = points
    .filter((p) => p.capturedAt.getTime() >= cutoff)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  if (recent.length < 3) return null;

  const t0 = recent[0]!.capturedAt.getTime();
  const day = 24 * 60 * 60 * 1000;
  const xs = recent.map((p) => (p.capturedAt.getTime() - t0) / day);
  const ys = recent.map((p) => p.elo);
  const mx = avg(xs);
  const my = avg(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;

  const slope = num / den; // ELO/jour
  const perDay = Math.round(slope * 10) / 10;
  const proj = Math.round(ys[ys.length - 1]! + slope * 14); // projection à 2 semaines
  let text: string;
  if (perDay >= 0.5) text = `à ce rythme (+${perDay}/j), ~${proj} dans 2 semaines 📈`;
  else if (perDay <= -0.5) text = `à ce rythme (${perDay}/j), ~${proj} dans 2 semaines 📉`;
  else text = `ELO stable (${perDay >= 0 ? "+" : ""}${perDay}/j) — ça plafonne.`;
  return { perDay, text };
}
