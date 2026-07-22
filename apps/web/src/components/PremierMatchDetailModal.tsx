import type { IconType } from "react-icons";
import {
  TbActivity,
  TbBomb,
  TbCrosshair,
  TbFlame,
  TbSkull,
  TbStar,
  TbSwords,
  TbTargetArrow,
  TbTrophy,
} from "react-icons/tb";
import type { PremierMatchSummary } from "@4eselo/types";
import { Modal, MapIcon } from "../ui";
import { cn } from "../lib/cn";
import { relativeTime, fullDate } from "../lib/relativeTime";
import { premierMatchRating, ratingColor } from "../lib/rating";
import { mapScreen } from "../lib/mapScreens";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());

/** Libellé + teinte du résultat (Premier connaît l'égalité, pas Faceit). */
function resultTone(result: PremierMatchSummary["result"]) {
  if (result === "win")
    return { label: "VICTOIRE", border: "border-win/25", text: "text-win", tint: "to-win/15" };
  if (result === "loss")
    return { label: "DÉFAITE", border: "border-loss/25", text: "text-loss", tint: "to-loss/15" };
  return { label: "ÉGALITÉ", border: "border-white/15", text: "text-ink-dim", tint: "to-white/10" };
}

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

/** Détail d'un match Premier : bandeau + rating en vedette + tableau de stats.
 *  Miroir de `MatchDetailModal` (Faceit) pour la parité visuelle — sans room ni
 *  clutch/flashs (non extraits de la démo, cf. PremierMatchStats). */
export function PremierMatchDetailModal({
  match,
  onClose,
}: {
  match: PremierMatchSummary | null;
  onClose: () => void;
}) {
  const s = match?.stats;
  const tone = match ? resultTone(match.result) : null;
  const r = s ? premierMatchRating(s) : null;

  return (
    <Modal open={!!match} onClose={onClose} title="Détail du match" size="lg">
      {match && s && tone && (
        <div className="flex flex-col gap-4 p-2">
          {/* Bannière : fond photo de la map (assombri) + teinte selon le résultat */}
          <div className={cn("relative overflow-hidden rounded-xl border p-4", tone.border)}>
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
            <div className={cn("absolute inset-0 bg-gradient-to-r from-bg via-bg/80", tone.tint)} />
            <div className="relative flex items-center gap-3">
              <MapIcon map={match.map} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold">{prettyMap(match.map)}</div>
                <div className="text-xs text-ink-dim" title={fullDate(match.playedAt)}>
                  {relativeTime(match.playedAt)}
                </div>
              </div>
              <div className="text-right">
                <div className={cn("text-sm font-extrabold tracking-wide", tone.text)}>{tone.label}</div>
                {match.myScore != null && match.oppScore != null && (
                  <div className="font-mono text-lg font-extrabold tabular-nums">
                    {match.myScore}
                    <span className="text-ink-faint"> : </span>
                    {match.oppScore}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bande vedette : rating + stats clés */}
          <div className="grid grid-cols-2 divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02] sm:grid-cols-4 sm:divide-x">
            <HeroCell
              icon={TbStar}
              label="Rating"
              value={r != null ? r.toFixed(2) : "-"}
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
            <Row icon={TbSwords} label="Entry (kills / morts)" value={`${s.firstKills} / ${s.firstDeaths}`} />
            <Row icon={TbBomb} label="Dégâts utilitaire" value={s.utilityDamage} />
          </div>
        </div>
      )}
    </Modal>
  );
}
