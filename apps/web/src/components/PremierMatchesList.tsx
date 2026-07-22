import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TbSwords } from "react-icons/tb";
import type { PremierMatchSummary } from "@4eselo/types";
import { getPlayerPremierMatches } from "../lib/api";
import { Card, HoverBarList, MapIcon, Skeleton } from "../ui";
import { cn } from "../lib/cn";
import { relativeTime, fullDate } from "../lib/relativeTime";
import { premierMatchRating, ratingColor } from "../lib/rating";
import { EmptyState } from "./EmptyState";
import { PremierMatchDetailModal } from "./PremierMatchDetailModal";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());

/** Pastille de résultat : V (win) / D (loss) / N (égalité), teintée. */
function ResultBadge({ result }: { result: PremierMatchSummary["result"] }) {
  const map = {
    win: { letter: "V", cls: "bg-win/12 text-win", title: "Victoire" },
    loss: { letter: "D", cls: "bg-loss/12 text-loss", title: "Défaite" },
    tie: { letter: "N", cls: "bg-white/[0.06] text-ink-dim", title: "Égalité" },
  }[result];
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-sm font-extrabold",
        map.cls,
      )}
      title={map.title}
    >
      {map.letter}
    </span>
  );
}

function MatchRowContent({ m }: { m: PremierMatchSummary }) {
  const r = premierMatchRating(m.stats);
  const hasScore = m.myScore != null && m.oppScore != null;
  return (
    <>
      <ResultBadge result={m.result} />
      <MapIcon map={m.map} size={30} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{prettyMap(m.map)}</div>
        <div className="text-xs text-ink-dim" title={fullDate(m.playedAt)}>
          {relativeTime(m.playedAt)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 font-mono text-sm font-semibold tabular-nums sm:gap-9">
        <span
          className={cn("w-11 text-right font-extrabold", r != null ? ratingColor(r) : "text-ink-faint")}
          title="Rating (façon HLTV)"
        >
          {r != null ? r.toFixed(2) : "-"}
        </span>
        <span className="hidden w-16 text-right sm:block">
          {m.stats.kills}
          <span className="text-ink-faint"> / </span>
          {m.stats.deaths}
        </span>
        <span className={cn("hidden w-12 text-right sm:block", m.stats.kd >= 1 ? "text-win" : "")}>
          {m.stats.kd.toFixed(2)}
        </span>
        <span className="hidden w-12 text-right sm:block">{m.stats.adr.toFixed(0)}</span>
        <span className="w-14 text-right" title="Score de la partie">
          {hasScore ? (
            <>
              {m.myScore}
              <span className="text-ink-faint"> : </span>
              {m.oppScore}
            </>
          ) : (
            <span className="text-ink-faint">-</span>
          )}
        </span>
      </div>
    </>
  );
}

/** Header aligné sur la structure exacte des lignes (mêmes gaps et largeurs). */
function Header() {
  return (
    <div className="mb-1 flex items-center gap-4 px-4 text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
      <span className="w-9 shrink-0 text-center">V/D</span>
      <span className="min-w-0 flex-1">Match</span>
      <span className="flex shrink-0 items-center gap-4 sm:gap-9">
        <span className="w-11 text-right">Rating</span>
        <span className="hidden w-16 text-right sm:block">K / D</span>
        <span className="hidden w-12 text-right sm:block">Ratio</span>
        <span className="hidden w-12 text-right sm:block">ADR</span>
        <span className="w-14 text-right">Score</span>
      </span>
    </div>
  );
}

/** Matchs Premier + stats par match (B18.15). Miroir de `MatchesList` (Faceit)
 *  pour la parité ; le ±ELO devient le score de la partie (pas de delta démo). */
export function PremierMatchesList({ id, limit = 10 }: { id: string; limit?: number }) {
  const [selected, setSelected] = useState<PremierMatchSummary | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["premierMatches", id, limit],
    queryFn: () => getPlayerPremierMatches(id, limit),
  });

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-1 p-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1.5 h-3 w-14" />
            </div>
            <Skeleton className="h-5 w-28" />
          </div>
        ))}
      </Card>
    );
  }

  if (isError) return <p className="text-sm text-loss">Matchs Premier indisponibles pour le moment.</p>;

  if (!data || data.items.length === 0) {
    return (
      <Card className="py-2">
        <EmptyState icon={TbSwords} title="Aucun match Premier analysé">
          Les stats par match Premier apparaîtront après une synchronisation.
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card className="p-2">
      <Header />
      <HoverBarList
        items={data.items}
        rowHeight={60}
        keyOf={(m) => m.shareCode}
        onSelect={(m) => setSelected(m)}
        children={(m) => <MatchRowContent m={m} />}
      />
      <PremierMatchDetailModal match={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}
