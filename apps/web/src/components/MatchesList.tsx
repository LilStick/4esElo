import { useQuery } from "@tanstack/react-query";
import { TbSwords } from "react-icons/tb";
import type { MatchSummary } from "@4eselo/types";
import { getPlayerMatches } from "../lib/api";
import { Card, HoverBarList, Skeleton } from "../ui";
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
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{prettyMap(m.map)}</div>
        <div className="text-xs text-ink-dim">{fmtDate(m.playedAt)}</div>
      </div>
      <div className="flex items-center gap-5 text-right font-mono text-sm tabular-nums">
        <div>
          <div className="font-semibold">
            {m.stats.kills}
            <span className="text-ink-faint"> / </span>
            {m.stats.deaths}
          </div>
          <div className="text-[10px] tracking-wider text-ink-faint uppercase">K / D</div>
        </div>
        <div className="hidden sm:block">
          <div className={cn("font-semibold", m.stats.kd >= 1 ? "text-win" : "")}>
            {m.stats.kd.toFixed(2)}
          </div>
          <div className="text-[10px] tracking-wider text-ink-faint uppercase">Ratio</div>
        </div>
        <div className="hidden sm:block">
          <div className="font-semibold">{m.stats.adr.toFixed(0)}</div>
          <div className="text-[10px] tracking-wider text-ink-faint uppercase">ADR</div>
        </div>
      </div>
    </>
  );
}

export function MatchesList({ id, limit = 10 }: { id: string; limit?: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["matches", id, limit],
    queryFn: () => getPlayerMatches(id, limit),
  });

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-1 p-[var(--bezel)]">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1.5 h-3 w-14" />
            </div>
            <Skeleton className="h-8 w-28" />
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
    <Card className="p-[var(--bezel)]">
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
