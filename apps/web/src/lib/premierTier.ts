/**
 * Palier CS Rating Premier — bandes de 5000 (0→30 000+), couleurs façon CS2 :
 * steel → cyan → bleu → violet → magenta → rouge → or. Le plus haut d'abord.
 * `color` = teinte vive (chevrons/accent) · `mid`/`dark` = dégradé du corps du badge.
 */
export interface PremierTier {
  /** Borne basse (incluse) de la bande. */
  min: number;
  name: string;
  color: string;
  mid: string;
  dark: string;
}

const TIERS: PremierTier[] = [
  { min: 30000, name: "gold", color: "#ffd23f", mid: "#8a6d15", dark: "#3f3410" },
  { min: 25000, name: "red", color: "#ff5a4a", mid: "#7a231c", dark: "#3f120e" },
  { min: 20000, name: "pink", color: "#ff5fd0", mid: "#7a2a63", dark: "#3f1436" },
  { min: 15000, name: "purple", color: "#a86bff", mid: "#42276e", dark: "#25153f" },
  { min: 10000, name: "blue", color: "#5a86ff", mid: "#26407a", dark: "#14213f" },
  { min: 5000, name: "sky", color: "#4db8ff", mid: "#1f5a7a", dark: "#123043" },
  { min: 0, name: "steel", color: "#9fb2cc", mid: "#3a4658", dark: "#222a36" },
];

/** Palier d'un CS Rating (clamp au plus bas pour les valeurs négatives / nulles). */
export function premierTier(rating: number): PremierTier {
  return TIERS.find((t) => rating >= t.min) ?? TIERS[TIERS.length - 1]!;
}

/** Libellé de la plage d'un palier (ex. « 25 000 – 29 999 », « 30 000+ »). */
export function premierRangeLabel(min: number): string {
  const fr = (n: number) => n.toLocaleString("fr-FR");
  return min >= 30000 ? `${fr(min)}+` : `${fr(min)} – ${fr(min + 4999)}`;
}
