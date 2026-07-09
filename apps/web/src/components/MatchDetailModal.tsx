import type { IconType } from "react-icons";
import {
  TbActivity,
  TbBolt,
  TbBomb,
  TbBulb,
  TbCrosshair,
  TbExternalLink,
  TbFlame,
  TbSkull,
  TbStar,
  TbSwords,
  TbTargetArrow,
  TbTrophy,
} from "react-icons/tb";
import { matchRoast, type MatchSummary } from "@4eselo/types";
import { Modal, MapIcon, Skeleton } from "../ui";
import { cn } from "../lib/cn";
import { relativeTime, fullDate } from "../lib/relativeTime";
import { matchRating, ratingColor } from "../lib/rating";
import { mapScreen } from "../lib/mapScreens";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());
const faceitRoom = (id: string) => `https://www.faceit.com/fr/cs2/room/${id}`;

/** Cellule vedette (bande horizontale) : icône + gros chiffre + libellé. */
function HeroCell({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: IconType;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-3 text-center">
      <Icon size={16} className="mb-1 text-ink-faint" />
      <div className={cn("font-mono text-2xl font-extrabold tabular-nums", accent ?? "text-ink")}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] tracking-[0.14em] text-ink-faint uppercase">{label}</div>
    </div>
  );
}

/** Ligne de tableau : icône + libellé ↔ valeur. */
function Row({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: IconType;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-white/[0.05] py-2.5 text-sm">
      <Icon size={15} className="shrink-0 text-brand/70" />
      <span className="flex-1 text-ink-dim">{label}</span>
      <span className={cn("font-mono font-bold tabular-nums", accent ?? "text-ink")}>{value}</span>
    </div>
  );
}

/** Modale de détail d'un match : bandeau + rating en vedette + tableau de stats.
 *  `open`/`loading` permettent de l'ouvrir avant que le match soit chargé (feed home #285). */
export function MatchDetailModal({
  match,
  onClose,
  open,
  loading = false,
}: {
  match: MatchSummary | null;
  onClose: () => void;
  open?: boolean;
  loading?: boolean;
}) {
  const isOpen = open ?? !!match;
  const s = match?.stats;
  const win = match?.result === 1;
  const r = s ? matchRating(s) : null;
  // Punchline contextuelle de la game (hype ou vanne), moteur partagé #263.
  const roast = s && match ? matchRoast(s, match.result) : null;

  return (
    <Modal open={isOpen} onClose={onClose} title="Détail du match" size="lg">
      {loading && !match && (
        <div className="flex flex-col gap-4 p-2">
          <Skeleton className="h-[76px] rounded-xl" />
          <Skeleton className="h-[92px] rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}
      {!loading && isOpen && !match && (
        <div className="p-8 text-center text-sm text-ink-dim">Détail du match indisponible.</div>
      )}
      {match && s && (
        <div className="flex flex-col gap-4 p-2">
          {/* Bannière : vrai fond photo de la map (assombri) + teinte V/D */}
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border p-4",
              win ? "border-win/25" : "border-loss/25",
            )}
          >
            {mapScreen(match.map) ? (
              <img
                src={mapScreen(match.map)}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full object-cover opacity-30"
              />
            ) : (
              <div className="pointer-events-none absolute top-1/2 -right-3 -translate-y-1/2 opacity-10">
                <MapIcon map={match.map} size={120} />
              </div>
            )}
            <div
              className={cn(
                "absolute inset-0",
                win
                  ? "bg-gradient-to-r from-bg via-bg/80 to-win/15"
                  : "bg-gradient-to-r from-bg via-bg/80 to-loss/15",
              )}
            />
            <div className="relative flex items-center gap-3">
              <MapIcon map={match.map} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold">{prettyMap(match.map)}</div>
                <div className="text-xs text-ink-dim" title={fullDate(match.playedAt)}>
                  {relativeTime(match.playedAt)}
                </div>
              </div>
              <div className="text-right">
                <div className={cn("text-sm font-extrabold tracking-wide", win ? "text-win" : "text-loss")}>
                  {win ? "VICTOIRE" : "DÉFAITE"}
                </div>
                {match.eloDelta != null && (
                  <div
                    className={cn(
                      "font-mono text-lg font-extrabold tabular-nums",
                      match.eloDelta > 0 ? "text-win" : "text-loss",
                    )}
                  >
                    {match.eloDelta > 0 ? "+" : ""}
                    {match.eloDelta} ELO
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Punchline 4esBot de la game (hype ou vanne) — barre d'accent + chip emoji, verre discret */}
          {roast && (
            <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] py-3 pr-4 pl-5">
              <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", win ? "bg-win" : "bg-loss")} />
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-xl leading-none">
                {roast.emoji}
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold tracking-[0.16em] text-ink-faint uppercase">
                  {roast.label}
                </div>
                <div className="text-sm font-medium text-ink">{roast.text}</div>
              </div>
            </div>
          )}

          {/* Bande vedette : rating + stats clés */}
          <div className="grid grid-cols-2 divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02] sm:grid-cols-4 sm:divide-x">
            <HeroCell
              icon={TbStar}
              label="Rating"
              value={r != null ? r.toFixed(2) : "—"}
              accent={r != null ? ratingColor(r) : undefined}
            />
            <HeroCell icon={TbSwords} label="K / D / A" value={`${s.kills}/${s.deaths}/${s.assists}`} />
            <HeroCell icon={TbActivity} label="ADR" value={s.adr.toFixed(0)} />
            <HeroCell icon={TbCrosshair} label="HS %" value={`${Math.round(s.hsPercent)}%`} />
          </div>

          {/* Tableau détaillé (2 colonnes) */}
          <div className="grid gap-x-10 sm:grid-cols-2">
            <Row
              icon={TbSkull}
              label="K/D"
              value={s.kd.toFixed(2)}
              accent={s.kd >= 1 ? "text-win" : "text-loss"}
            />
            <Row icon={TbTargetArrow} label="Kills / round" value={s.kr.toFixed(2)} />
            <Row icon={TbTrophy} label="MVPs" value={s.mvps} />
            <Row
              icon={TbFlame}
              label="Multi-kills"
              value={`${s.tripleKills}×3K · ${s.quadroKills}×4K · ${s.pentaKills}×5K`}
            />
            <Row icon={TbBolt} label="Clutch 1v1" value={`${s.clutch1v1Wins} / ${s.clutch1v1Count}`} />
            <Row icon={TbBolt} label="Clutch 1v2" value={`${s.clutch1v2Wins} / ${s.clutch1v2Count}`} />
            <Row icon={TbSwords} label="Entry (gagnés / tentés)" value={`${s.entryWins} / ${s.entryCount}`} />
            <Row icon={TbBomb} label="Dégâts utilitaire" value={s.utilityDamage} />
            <Row icon={TbBulb} label="Ennemis flashés" value={s.enemiesFlashed} />
          </div>

          <a
            href={faceitRoom(match.matchId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 self-end text-sm font-semibold text-brand transition-colors hover:text-brand-hi"
          >
            Voir la room Faceit <TbExternalLink size={15} />
          </a>
        </div>
      )}
    </Modal>
  );
}
