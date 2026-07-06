import { useQuery } from "@tanstack/react-query";
import { TbSwords } from "react-icons/tb";
import type { MatchSummary } from "@4eselo/types";
import { getPlayerMatches } from "../lib/api";
import { Card, HoverBarList, MapIcon, Skeleton } from "../ui";
import { cn } from "../lib/cn";
import { EmptyState } from "./EmptyState";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());
const faceitRoom = (id: string) => `https://www.faceit.com/fr/cs2/room/${id}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

function MatchRowContent({ m }: { m: MatchSummary }) {
  const win = m.result === 1;
  return (
    <>
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-sm font-extrabold",
          win ? "bg-win/12 text-win" : "bg-loss/12 text-loss",
        )}
        title={win ? "Victoire" : "Défaite"}
      >
        {win ? "V" : "D"}
      </span>
      <MapIcon map={m.map} size={30} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{prettyMap(m.map)}</div>
        <div className="text-xs text-ink-dim">{fmtDate(m.playedAt)}</div>
      </div>
      <div className="flex shrink-0 items-center gap-6 font-mono text-sm font-semibold tabular-nums sm:gap-9">
        <span className="w-16 text-right">
          {m.stats.kills}
          <span className="text-ink-faint"> / </span>
          {m.stats.deaths}
        </span>
        <span className={cn("hidden w-12 text-right sm:block", m.stats.kd >= 1 ? "text-win" : "")}>
          {m.stats.kd.toFixed(2)}
        </span>
        <span className="hidden w-12 text-right sm:block">{m.stats.adr.toFixed(0)}</span>
        <span
          className={cn(
            "w-12 text-right",
            m.eloDelta == null ? "text-ink-faint" : m.eloDelta > 0 ? "text-win" : "text-loss",
          )}
          title="±ELO du match"
        >
          {m.eloDelta == null ? "—" : `${m.eloDelta > 0 ? "+" : ""}${m.eloDelta}`}
        </span>
      </div>
    </>
  );
}

/** Header aligné sur la structure exacte des lignes (mêmes gaps et largeurs). */
function Header() {
  return (
    <div className="mb-1 flex items-center gap-4 px-4 text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
      <span className="w-9 shrink-0 text-center">W/L</span>
      <span className="min-w-0 flex-1">Match</span>
      <span className="flex shrink-0 items-center gap-6 sm:gap-9">
        <span className="w-16 text-right">K / D</span>
        <span className="hidden w-12 text-right sm:block">Ratio</span>
        <span className="hidden w-12 text-right sm:block">ADR</span>
        <span className="w-12 text-right">±ELO</span>
      </span>
    </div>
  );
}

export function MatchesList({ id, limit = 10 }: { id: string; limit?: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["matches", id, limit],
    queryFn: () => getPlayerMatches(id, limit),
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

  if (isError) return <p className="text-sm text-loss">Matchs indisponibles pour le moment.</p>;

  if (!data || data.items.length === 0) {
    return (
      <Card className="py-2">
        <EmptyState icon={TbSwords} title="Aucun match analysé">
          Les matchs récents apparaîtront après une synchronisation.
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
        keyOf={(m) => m.matchId}
        hrefOf={(m) => faceitRoom(m.matchId)}
        external
        children={(m) => <MatchRowContent m={m} />}
      />
    </Card>
  );
}
