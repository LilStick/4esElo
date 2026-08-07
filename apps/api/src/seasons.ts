import { Hono } from "hono";
import { gte, lt, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Season, SeasonsResponse } from "@4eselo/types";

/**
 * Modèle de saison Faceit (B19.2). L'API FACEIT n'expose AUCUN id de saison → on
 * dérive la saison de la date (qu'on stocke et indexe déjà). Source de vérité : les
 * bornes de début ci-dessous, triées par date croissante. La fin d'une saison = le
 * début de la suivante (null pour la saison courante). **Ajouter une saison = une ligne.**
 * (Season 8 = soft reset + placement le 22/04/2026.)
 */
const STARTS: readonly { id: string; label: string; startsAt: string }[] = [
  { id: "S8", label: "Saison 8", startsAt: "2026-04-22T00:00:00.000Z" },
];

export interface SeasonRange {
  id: string;
  start: Date;
  /** null = saison courante (pas de borne haute). */
  end: Date | null;
}

type SeasonStart = { id: string; label: string; startsAt: string };

/** Dérivation pure (testable avec une liste synthétique) : endsAt = début de la suivante. */
export function deriveSeasons(starts: readonly SeasonStart[]): Season[] {
  return starts.map((s, i) => ({
    id: s.id,
    label: s.label,
    startsAt: s.startsAt,
    endsAt: starts[i + 1]?.startsAt ?? null,
  }));
}

/** Plage [start, end) d'une saison dans une liste donnée, ou null si l'id est inconnu. */
export function deriveSeasonRange(starts: readonly SeasonStart[], id: string): SeasonRange | null {
  const i = starts.findIndex((s) => s.id === id);
  if (i < 0) return null;
  return {
    id,
    start: new Date(starts[i]!.startsAt),
    end: starts[i + 1] ? new Date(starts[i + 1]!.startsAt) : null,
  };
}

/** Liste exposée au front (bornes ISO ; endsAt dérivé de la saison suivante). */
export function listSeasons(): Season[] {
  return deriveSeasons(STARTS);
}

/** Plage [start, end) d'une saison, ou null si l'id est inconnu. */
export function seasonRange(id: string): SeasonRange | null {
  return deriveSeasonRange(STARTS, id);
}

export type SeasonParse =
  | { ok: true; range: SeasonRange | null } // range null = pas de filtre (toutes saisons)
  | { ok: false }; // id de saison inconnu → le handler renvoie 400

/** Lit `?season=` : absent → pas de filtre ; connu → plage ; inconnu → { ok:false }. */
export function parseSeason(raw: string | undefined): SeasonParse {
  if (!raw) return { ok: true, range: null };
  const range = seasonRange(raw);
  return range ? { ok: true, range } : { ok: false };
}

/**
 * Conditions SQL de bornage d'une colonne date sur une plage de saison, à spread dans
 * un `and(...)`. `[]` si pas de filtre → aucune contrainte ajoutée.
 */
export function seasonConds(col: PgColumn, range: SeasonRange | null): SQL[] {
  if (!range) return [];
  const conds: SQL[] = [gte(col, range.start)];
  if (range.end) conds.push(lt(col, range.end));
  return conds;
}

export const seasonsRoutes = new Hono();

seasonsRoutes.get("/seasons", (c) => c.json<SeasonsResponse>({ seasons: listSeasons() }));
