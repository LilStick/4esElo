/** Palier CS Rating Premier (bandes de 5000) → couleur + nom. Le plus haut d'abord. */
export interface PremierTier {
  /** Borne basse (incluse) de la bande. */
  min: number;
  name: string;
  color: string;
}

const TIERS: PremierTier[] = [
  { min: 30000, name: "gold", color: "#FED700" },
  { min: 25000, name: "red", color: "#ff5a5a" },
  { min: 20000, name: "pink", color: "#ff4fa3" },
  { min: 15000, name: "purple", color: "#b46bff" },
  { min: 10000, name: "blue", color: "#4a7dff" },
  { min: 5000, name: "sky", color: "#6fb7ff" },
  { min: 0, name: "grey", color: "#c8cfda" },
];

/** Palier d'un CS Rating (clamp à grey pour les valeurs négatives / nulles). */
export function premierTier(rating: number): PremierTier {
  return TIERS.find((t) => rating >= t.min) ?? TIERS[TIERS.length - 1]!;
}
