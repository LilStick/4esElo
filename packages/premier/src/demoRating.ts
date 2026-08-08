import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { z } from "zod";
import type { PremierMatchStats } from "@4eselo/types";
import { computeMatchStats } from "./demoStats";

// seek-bzip n'a pas de types → require typé inline (marche cross-package sans shim).
const Bzip2: { decode(buf: Buffer): Buffer } = createRequire(import.meta.url)("seek-bzip");

/**
 * ⚠️ NON OFFICIEL / FRAGILE — download démo Valve + décompression bz2 + parse via
 * la lib native `demoparser2`. Le format démo comme le CDN Valve peuvent changer du
 * jour au lendemain (cf. ROADMAP → Décisions 2026-07-03, endpoint ELO mort). La
 * sortie de demoparser2 est donc validée en zod (RANK/events/header) AVANT usage :
 * un drift de shape échoue bruyamment ici au lieu de calculer un rating faux.
 *
 * `demoparser2` (binaire natif) est importé PARESSEUSEMENT dans parseDemoMatch : le
 * barrel `@4eselo/premier` réexporte cette fonction, et l'API n'a besoin que de
 * `encryptSecret` → sans le lazy import, importer le barrel chargerait le binaire
 * natif dans le process API au boot (fuite de couche + risque de portabilité).
 *
 * Extraction du CS Rating depuis une démo Premier (B18.3). I/O isolée dans le
 * package provider (download + décompression bz2 + parse demoparser2).
 * Le rating vit dans la démo : `rank` (avant) + `rank_if_win|loss|tie` (selon le
 * résultat). Compétitif (tiers 1-18) est écarté (rating Premier = milliers).
 */

const RANK_FIELDS = ["rank", "rank_if_win", "rank_if_loss", "rank_if_tie", "team_num", "team_rounds_total"];
// Seuil sous lequel une valeur n'est pas un CS Rating Premier (qui vit dans les milliers).
const PREMIER_MIN_RATING = 1000;
// Tiers Compétitif / Wingman : rank ∈ 1..18 (≠ Premier). Un rank à 0 = placement.
const COMP_TIER_MAX = 18;

export interface DemoTickRow {
  steamid: string;
  tick: number;
  rank: number;
  rank_if_win: number;
  rank_if_loss: number;
  rank_if_tie: number;
  team_num: number;
  team_rounds_total: number;
}

export interface RatingResult {
  /** CS Rating après le match, ou null en placement (pas encore de rating attribué). */
  ratingAfter: number | null;
  result: "win" | "loss" | "tie";
  myScore: number;
  oppScore: number;
}

/**
 * Rating du membre après le match. null = à ignorer (joueur absent, ou match
 * Compétitif/Wingman). Le Premier en placement (rank 0, pas encore classé) est
 * RETOURNÉ avec `ratingAfter: null` : le match compte, mais il ne pose pas de
 * point de courbe tant qu'un rating n'est pas attribué (10e game de placement).
 * NB : un placement Premier et un placement Compétitif ont tous deux rank 0 →
 * indiscernables ici ; c'est `reservation.game_type` (resolver) qui tranche en amont.
 * Pur, testable.
 */
export function computeRatingAfter(rows: DemoTickRow[], steamId64: string): RatingResult | null {
  const lastByPlayer = new Map<string, DemoTickRow>();
  for (const r of [...rows].sort((a, b) => a.tick - b.tick)) lastByPlayer.set(String(r.steamid), r);
  const me = lastByPlayer.get(steamId64);
  if (!me) return null;
  // Compétitif / Wingman : rank est un tier 1-18, pas un CS Rating → on écarte.
  const rank = me.rank ?? 0;
  if (rank >= 1 && rank <= COMP_TIER_MAX) return null;
  const oppScore = Math.max(
    0,
    ...[...lastByPlayer.values()]
      .filter((r) => r.team_num !== me.team_num)
      .map((r) => r.team_rounds_total ?? 0),
  );
  const myScore = me.team_rounds_total ?? 0;
  const result = myScore > oppScore ? "win" : myScore < oppScore ? "loss" : "tie";
  const projected = result === "win" ? me.rank_if_win : result === "loss" ? me.rank_if_loss : me.rank_if_tie;
  // Placement : rank courant + rating projeté encore sous le seuil → pas de rating.
  const ratingAfter = projected >= PREMIER_MIN_RATING ? projected : null;
  return { ratingAfter, result, myScore, oppScore };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Download de la démo, avec retry sur erreur réseau. Les gros fichiers Valve
 * coupent souvent en cours (`fetch failed` = ECONNRESET/socket) → sans retry on
 * perdait des matchs. Un vrai statut d'erreur HTTP (404/502 = démo expirée) n'est
 * PAS retenté. null = démo indisponible ; throw = réseau KO après tous les essais.
 */
export async function downloadDemo(
  demoUrl: string,
  fetchImpl: typeof fetch = fetch,
  opts: { retries?: number; backoffMs?: number } = {},
): Promise<Buffer | null> {
  const retries = opts.retries ?? 3;
  const backoffMs = opts.backoffMs ?? 500;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchImpl(demoUrl);
      if (!res.ok) return null; // 404/502 = démo expirée → inutile de retenter
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length < 1000 ? null : buf; // 200 vide = erreur déguisée
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(backoffMs * 2 ** attempt);
    }
  }
}

export interface DemoMatchResult {
  /** null = placement (pas encore de CS Rating) ; le match compte quand même. */
  ratingAfter: number | null;
  result: "win" | "loss" | "tie";
  myScore: number;
  oppScore: number;
  map: string;
  stats: PremierMatchStats;
}

// --- Validation zod de la sortie demoparser2 (frontière externe non fiable) -----

// Champ entier tolérant : absent/null → 0 (comme le faisait `?? 0`), mais un type
// non-numérique (drift de shape) échoue.
const intField = z
  .number()
  .nullish()
  .transform((v) => v ?? 0);

// steamid en STRING STRICT : demoparser2 sérialise les u64 en string pour éviter la
// perte de précision JS (un steam64 > 2^53). S'il renvoyait un jour un number, on
// échoue ICI plutôt que de corrompre silencieusement l'identité du joueur.
const demoTickRowSchema = z.object({
  steamid: z.string().min(1),
  tick: z.number(),
  rank: intField,
  rank_if_win: intField,
  rank_if_loss: intField,
  rank_if_tie: intField,
  team_num: intField,
  team_rounds_total: intField,
});
export const demoTicksSchema = z.array(demoTickRowSchema);

// Events : steamids tolérants (string|number|null, comme l'exige demoStats via son
// helper `sid`), mais la forme « tableau d'objets nommés » est validée.
const eventSteamId = z.union([z.string(), z.number()]).nullish();
const deathEventSchema = z
  .object({
    attacker_steamid: eventSteamId,
    user_steamid: eventSteamId,
    assister_steamid: eventSteamId,
    headshot: z.boolean().nullish(),
    total_rounds_played: z.number().nullish(),
    tick: z.number(),
  })
  .passthrough();
const hurtEventSchema = z
  .object({
    attacker_steamid: eventSteamId,
    user_steamid: eventSteamId,
    dmg_health: z.number().nullish(),
    weapon: z.string().nullish(),
  })
  .passthrough();
const mvpEventSchema = z.object({ user_steamid: eventSteamId }).passthrough();
export const demoEventsSchema = z.array(z.object({ event_name: z.string() }).passthrough());

const demoHeaderSchema = z.object({ map_name: z.string().optional() }).passthrough();

/**
 * Télécharge + parse une démo → rating + stats du membre, en UN download et 2
 * passes de parse (ticks pour le rank, events pour les stats). null = irrésolvable
 * (démo expirée, pas Premier). Réutilisé par le worker via un process enfant.
 */
export async function parseDemoMatch(
  demoUrl: string,
  steamId64: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DemoMatchResult | null> {
  const compressed = await downloadDemo(demoUrl, fetchImpl);
  if (!compressed) return null;
  // Import paresseux du binaire natif : voir l'en-tête (l'API ne doit pas le charger au boot).
  const { parseTicks, parseEvents, parseHeader } = await import("@laihoe/demoparser2");
  const dem = Bzip2.decode(compressed);
  const tmp = join(tmpdir(), `premier-${randomUUID()}.dem`);
  writeFileSync(tmp, dem);
  try {
    const rating = computeRatingAfter(demoTicksSchema.parse(parseTicks(tmp, RANK_FIELDS)), steamId64);
    if (!rating) return null; // Compétitif/Wingman ou joueur absent → on n'ingère pas (placement = non-null)
    const events = demoEventsSchema.parse(
      parseEvents(tmp, ["player_death", "player_hurt", "round_mvp"], [], ["total_rounds_played"]),
    );
    const deaths = events
      .filter((e) => e.event_name === "player_death")
      .map((e) => deathEventSchema.parse(e));
    const hurts = events.filter((e) => e.event_name === "player_hurt").map((e) => hurtEventSchema.parse(e));
    const mvps = events.filter((e) => e.event_name === "round_mvp").map((e) => mvpEventSchema.parse(e));
    const stats = computeMatchStats({
      steamId64,
      rounds: rating.myScore + rating.oppScore,
      deaths,
      hurts,
      mvps,
    });
    const header = demoHeaderSchema.parse(parseHeader(tmp));
    return { ...rating, map: header.map_name ?? "unknown", stats };
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // best-effort : nettoyé au reboot si la suppression échoue
    }
  }
}
