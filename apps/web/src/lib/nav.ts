/**
 * A-t-on un historique de navigation interne à l'app ?
 * React Router marque l'entrée initiale (atterrissage direct, lien partagé,
 * rechargement) avec `location.key === "default"` : dans ce cas `navigate(-1)`
 * sortirait du site (ou ne ferait rien) → il faut un fallback explicite.
 */
export function hasInAppHistory(locationKey: string): boolean {
  return locationKey !== "default";
}
