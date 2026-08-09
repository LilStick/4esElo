import type { EloSource } from "@4eselo/types";

/** Préférence de source ELO (Faceit / Premier), persistée localStorage. */
export const ELO_SOURCE_KEY = "4eselo:elo-source";

export const isEloSource = (v: unknown): v is EloSource => v === "faceit" || v === "premier";

/** L'autre source (pour un toggle binaire). */
export const otherSource = (s: EloSource): EloSource => (s === "faceit" ? "premier" : "faceit");

/** Libellé humain d'une source. */
export const sourceLabel = (s: EloSource): string => (s === "premier" ? "Premier" : "Faceit");

/**
 * Source effective : priorité à l'URL (partageable) sinon la préférence stockée,
 * **clampée sur Faceit quand Premier est off** (#479). Sans ce clamp, un lien
 * `?source=premier` ou un localStorage resté sur "premier" fige l'UI en Premier
 * alors que le back a fermé la surface (flag off) → écrans vides, resync en 503.
 */
export function resolveSource(
  urlSource: string | null,
  stored: EloSource,
  premierEnabled: boolean,
): EloSource {
  const resolved: EloSource = isEloSource(urlSource) ? urlSource : stored;
  return premierEnabled ? resolved : "faceit";
}
