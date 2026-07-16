import type { AchievementDef } from "@4eselo/types";

// Succès permanents (B7.8), logique pure. Déblocage (current ≥ target) figé en DB à la 1re détection.

export interface AchievementInput {
  matches: number;
  wins: number;
  kills: number;
  /** Aces = manches à 5 kills (pentaKills). */
  aces: number;
  clutchWins: number;
  entryWins: number;
  mvps: number;
  sniperKills: number;
  /** ELO max jamais atteint. */
  maxElo: number;
  /** Meilleur gain d'ELO sur une fenêtre glissante de 30 j. */
  bestEloGain30d: number;
}

interface CatalogEntry extends AchievementDef {
  metric: (i: AchievementInput) => number;
}

export const ACHIEVEMENTS: CatalogEntry[] = [
  {
    id: "games_100",
    emoji: "🎮",
    label: "Centenaire",
    description: "Jouer 100 matchs",
    target: 100,
    metric: (i) => i.matches,
  },
  {
    id: "games_500",
    emoji: "🏙️",
    label: "Pilier du pôle",
    description: "Jouer 500 matchs",
    target: 500,
    metric: (i) => i.matches,
  },
  {
    id: "wins_100",
    emoji: "🏆",
    label: "Centurion",
    description: "Gagner 100 matchs",
    target: 100,
    metric: (i) => i.wins,
  },
  {
    id: "kills_1000",
    emoji: "🔫",
    label: "Mille morts",
    description: "1 000 kills cumulés",
    target: 1000,
    metric: (i) => i.kills,
  },
  {
    id: "kills_10000",
    emoji: "💀",
    label: "Faucheur",
    description: "10 000 kills cumulés",
    target: 10000,
    metric: (i) => i.kills,
  },
  {
    id: "ace_1",
    emoji: "🎽",
    label: "Premier ace",
    description: "Réussir un ace (5 kills en une manche)",
    target: 1,
    metric: (i) => i.aces,
  },
  {
    id: "ace_10",
    emoji: "✋",
    label: "Collectionneur d'aces",
    description: "Réussir 10 aces",
    target: 10,
    metric: (i) => i.aces,
  },
  {
    id: "clutch_10",
    emoji: "🧠",
    label: "Sang-froid",
    description: "Gagner 10 clutchs (1v1/1v2)",
    target: 10,
    metric: (i) => i.clutchWins,
  },
  {
    id: "clutch_50",
    emoji: "🥶",
    label: "Maître du clutch",
    description: "Gagner 50 clutchs",
    target: 50,
    metric: (i) => i.clutchWins,
  },
  {
    id: "entry_50",
    emoji: "💣",
    label: "Fer de lance",
    description: "Gagner 50 duels d'entrée",
    target: 50,
    metric: (i) => i.entryWins,
  },
  {
    id: "mvp_100",
    emoji: "⭐",
    label: "Homme du match",
    description: "Décrocher 100 MVP",
    target: 100,
    metric: (i) => i.mvps,
  },
  {
    id: "sniper_100",
    emoji: "🎯",
    label: "AWPeur",
    description: "100 kills au sniper",
    target: 100,
    metric: (i) => i.sniperKills,
  },
  {
    id: "elo_2000",
    emoji: "📈",
    label: "Élite",
    description: "Atteindre 2000 ELO",
    target: 2000,
    metric: (i) => i.maxElo,
  },
  {
    id: "climb_200",
    emoji: "🚀",
    label: "Ascension",
    description: "+200 ELO en un mois",
    target: 200,
    metric: (i) => i.bestEloGain30d,
  },
  {
    id: "games_1000",
    emoji: "🏛️",
    label: "Légende vivante",
    description: "Jouer 1 000 matchs",
    target: 1000,
    metric: (i) => i.matches,
  },
  {
    id: "wins_250",
    emoji: "🎖️",
    label: "Vétéran",
    description: "Gagner 250 matchs",
    target: 250,
    metric: (i) => i.wins,
  },
  {
    id: "wins_500",
    emoji: "👑",
    label: "Conquérant",
    description: "Gagner 500 matchs",
    target: 500,
    metric: (i) => i.wins,
  },
  {
    id: "kills_25000",
    emoji: "🌾",
    label: "Moissonneur",
    description: "25 000 kills cumulés",
    target: 25000,
    metric: (i) => i.kills,
  },
  {
    id: "kills_50000",
    emoji: "☠️",
    label: "Extincteur d'espoirs",
    description: "50 000 kills cumulés",
    target: 50000,
    metric: (i) => i.kills,
  },
  {
    id: "clutch_150",
    emoji: "🧊",
    label: "Glacial",
    description: "Gagner 150 clutchs",
    target: 150,
    metric: (i) => i.clutchWins,
  },
  {
    id: "entry_150",
    emoji: "🐏",
    label: "Bélier",
    description: "Gagner 150 duels d'entrée",
    target: 150,
    metric: (i) => i.entryWins,
  },
  {
    id: "mvp_300",
    emoji: "🌟",
    label: "Superstar",
    description: "Décrocher 300 MVP",
    target: 300,
    metric: (i) => i.mvps,
  },
  {
    id: "ace_25",
    emoji: "🖐️",
    label: "Faiseur d'aces",
    description: "Réussir 25 aces",
    target: 25,
    metric: (i) => i.aces,
  },
  {
    id: "sniper_500",
    emoji: "🥇",
    label: "Légende AWP",
    description: "500 kills au sniper",
    target: 500,
    metric: (i) => i.sniperKills,
  },
  {
    id: "elo_2500",
    emoji: "🔱",
    label: "Titan",
    description: "Atteindre 2500 ELO",
    target: 2500,
    metric: (i) => i.maxElo,
  },
  {
    id: "elo_3000",
    emoji: "🌌",
    label: "Stratosphère",
    description: "Atteindre 3000 ELO",
    target: 3000,
    metric: (i) => i.maxElo,
  },
  {
    id: "climb_400",
    emoji: "🛸",
    label: "Décollage",
    description: "+400 ELO en un mois",
    target: 400,
    metric: (i) => i.bestEloGain30d,
  },
];

export interface EvaluatedAchievement {
  def: AchievementDef;
  current: number;
  unlocked: boolean;
}

export function evaluateAchievements(input: AchievementInput): EvaluatedAchievement[] {
  return ACHIEVEMENTS.map((a) => {
    const current = Math.max(0, Math.floor(a.metric(input)));
    return {
      def: { id: a.id, emoji: a.emoji, label: a.label, description: a.description, target: a.target },
      current,
      unlocked: current >= a.target,
    };
  });
}

/** Meilleur gain d'ELO sur fenêtre ≤ windowMs ; points triés par date croissante. */
export function bestEloGainWithin(points: { elo: number; capturedAt: Date }[], windowMs: number): number {
  let best = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (points[j]!.capturedAt.getTime() - points[i]!.capturedAt.getTime() > windowMs) break;
      best = Math.max(best, points[j]!.elo - points[i]!.elo);
    }
  }
  return best;
}
