/**
 * Recap hebdo du pôle (B5.7) : chaque lundi, une annonce résume la semaine ISO
 * écoulée (games, grinder, meilleure prog, pire semaine). Dédup par semaine ISO
 * → relançable sans doublon, part à la relance suivante si le worker était down.
 * Pure logic - DB via `WeekActivityReader`.
 */
import type { AnnouncementStore } from "./announce";

const DAY_MS = 86_400_000;

export interface PlayerWeekActivity {
  nickname: string;
  /** Games jouées sur la semaine (> 0 : seuls les actifs sont remontés). */
  games: number;
  /** ±ELO sur la semaine (elo fin − elo début) ; null si on n'a pas les deux bornes. */
  eloDelta: number | null;
}

export interface WeekActivityReader {
  weekActivity(start: Date, end: Date): Promise<PlayerWeekActivity[]>;
}

export interface WeeklyDigest {
  totalGames: number;
  grinder: { nickname: string; games: number } | null;
  topGain: { nickname: string; delta: number } | null;
  topLoss: { nickname: string; delta: number } | null;
}

export type WeeklyRecapResult =
  | { status: "posted"; year: number; week: number; digest: WeeklyDigest }
  | { status: "already-announced"; year: number; week: number }
  | { status: "empty-week"; year: number; week: number };

/** Lundi 00:00 UTC de la semaine ISO de `d`. */
function startOfIsoWeekUtc(d: Date): Date {
  const daysSinceMonday = (d.getUTCDay() + 6) % 7; // dim=0 → 6, lun=1 → 0…
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday));
}

/** Numéro de semaine ISO 8601 (+ année ISO) d'une date. */
export function isoWeek(d: Date): { year: number; week: number } {
  // On se cale sur le jeudi de la semaine : il porte l'année ISO.
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() - ((thursday.getUTCDay() + 6) % 7) + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { year: thursday.getUTCFullYear(), week };
}

/** La semaine ISO écoulée : [lundi précédent, lundi courant), + son année/semaine ISO. */
export function previousWeekRange(now: Date): {
  start: Date;
  end: Date;
  year: number;
  week: number;
} {
  const end = startOfIsoWeekUtc(now); // lundi de la semaine en cours
  const start = new Date(end.getTime() - 7 * DAY_MS); // lundi précédent
  return { start, end, ...isoWeek(start) };
}

/** Compose le digest à partir de l'activité brute (pur, testable sans I/O). */
export function buildDigest(activity: PlayerWeekActivity[]): WeeklyDigest {
  const totalGames = activity.reduce((sum, p) => sum + p.games, 0);

  const grinder = activity.reduce<WeeklyDigest["grinder"]>((best, p) => {
    if (p.games <= 0) return best;
    return best === null || p.games > best.games ? { nickname: p.nickname, games: p.games } : best;
  }, null);

  const withDelta = activity.filter(
    (p): p is PlayerWeekActivity & { eloDelta: number } => p.eloDelta !== null,
  );

  const topGain = withDelta.reduce<WeeklyDigest["topGain"]>((best, p) => {
    if (p.eloDelta <= 0) return best;
    return best === null || p.eloDelta > best.delta ? { nickname: p.nickname, delta: p.eloDelta } : best;
  }, null);

  const topLoss = withDelta.reduce<WeeklyDigest["topLoss"]>((best, p) => {
    if (p.eloDelta >= 0) return best;
    return best === null || p.eloDelta < best.delta ? { nickname: p.nickname, delta: p.eloDelta } : best;
  }, null);

  return { totalGames, grinder, topGain, topLoss };
}

/** Texte libre de l'annonce (affiché tel quel par la bannière home #225). */
export function formatRecapBody(d: WeeklyDigest): string {
  const parts = [
    `${d.totalGames} game${d.totalGames > 1 ? "s" : ""} jouée${d.totalGames > 1 ? "s" : ""} cette semaine 🎮`,
  ];
  if (d.grinder) {
    parts.push(`🔥 Plus gros grinder : ${d.grinder.nickname} (${d.grinder.games} games)`);
  }
  if (d.topGain) {
    parts.push(`📈 Plus belle progression : ${d.topGain.nickname} (+${d.topGain.delta} ELO)`);
  }
  if (d.topLoss) {
    parts.push(`📉 Plus dure semaine : ${d.topLoss.nickname} (${d.topLoss.delta} ELO)`);
  }
  return parts.join(" · ");
}

export async function announceWeeklyRecap(
  store: AnnouncementStore,
  reader: WeekActivityReader,
  now: () => Date = () => new Date(),
): Promise<WeeklyRecapResult> {
  const { start, end, year, week } = previousWeekRange(now());
  const digest = buildDigest(await reader.weekActivity(start, end));

  if (digest.totalGames === 0) {
    return { status: "empty-week", year, week };
  }

  const inserted = await store.insertUnique({
    type: "weekly-recap",
    title: "La semaine du pôle 📅",
    body: formatRecapBody(digest),
    dedupeKey: `weekly-recap-${year}-W${String(week).padStart(2, "0")}`,
  });

  return inserted ? { status: "posted", year, week, digest } : { status: "already-announced", year, week };
}
