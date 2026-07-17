import type { EloSource } from "@4eselo/types";

/** Préférence de source ELO (Faceit / Premier), persistée localStorage. */
export const ELO_SOURCE_KEY = "4eselo:elo-source";

export const isEloSource = (v: unknown): v is EloSource => v === "faceit" || v === "premier";

/** L'autre source (pour un toggle binaire). */
export const otherSource = (s: EloSource): EloSource => (s === "faceit" ? "premier" : "faceit");

/** Libellé humain d'une source. */
export const sourceLabel = (s: EloSource): string => (s === "premier" ? "Premier" : "Faceit");
