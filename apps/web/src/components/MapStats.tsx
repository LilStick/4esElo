import { useQuery } from "@tanstack/react-query";
import { TbMap2 } from "react-icons/tb";
import type { StatsRange } from "@4eselo/types";
import type { MapStat } from "@4eselo/types";
import { getPlayerStats } from "../lib/api";
import { Card, HoverBarList, Skeleton } from "../ui";
import { cn } from "../lib/cn";
import { EmptyState } from "./EmptyState";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());

function MapRowContent({ m }: { m: MapStat }) {
  return (
    <>
      <span className="min-w-0 flex-1 truncate font-semibold">{prettyMap(m.map)}</span>
      <span className="flex shrink-0 items-center gap-6 font-mono text-sm tabular-nums sm:gap-9">
        <span className="hidden w-14 text-right text-ink-dim sm:block">{m.matches}</span>
        <span className="flex w-24 items-center gap-2 sm:w-28">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <span
              className={cn("block h-full rounded-full", m.winRate >= 50 ? "bg-win" : "bg-loss")}
              style={{ width: `${m.winRate}%` }}
            />
          </span>
          <span className={cn("w-9 text-right font-semibold", m.winRate >= 50 ? "text-win" : "text-loss")}>
            {Math.round(m.winRate)}%
          </span>
        </span>
        <span className={cn("w-12 text-right font-semibold", m.kd >= 1 ? "text-win" : "")}>
          {m.kd.toFixed(2)}
        </span>
        <span className="hidden w-12 text-right sm:block">{m.adr.toFixed(0)}</span>
      </span>
    </>
  );
}

/** En-tête aligné sur la structure exacte des lignes (mêmes gaps + largeurs). */
function Header() {
  return (
    <div className="mb-1 flex items-center gap-4 px-4 text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
      <span className="min-w-0 flex-1">Map</span>
      <span className="flex shrink-0 items-center gap-6 sm:gap-9">
        <span className="hidden w-14 text-right sm:block">Matchs</span>
        <span className="w-24 text-right sm:w-28">Winrate</span>
        <span className="w-12 text-right">K/D</span>
        <span className="hidden w-12 text-right sm:block">ADR</span>
      </span>
    </div>
  );
}

export function MapStats({ id, range = "all" }: { id: string; range?: StatsRange }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats", id, range],
    queryFn: () => getPlayerStats(id, range),
  });

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-2 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="mx-2 h-6" />
        ))}
      </Card>
    );
  }

  if (isError) return <p className="text-sm text-loss">Stats par map indisponibles.</p>;

  const maps = data ? [...data.maps].sort((a, b) => b.matches - a.matches) : [];
  if (maps.length === 0) {
    return (
      <Card className="py-2">
        <EmptyState icon={TbMap2} title="Pas encore de stats par map">
          Elles apparaîtront après quelques matchs synchronisés.
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card className="p-2">
      <Header />
      <HoverBarList
        items={maps}
        rowHeight={48}
        keyOf={(m) => m.map}
        children={(m) => <MapRowContent m={m} />}
      />
    </Card>
  );
}
