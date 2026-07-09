import { useQuery } from "@tanstack/react-query";
import { TbChartBar } from "react-icons/tb";
import type { StatsRange } from "@4eselo/types";
import { getPlayerStats } from "../lib/api";
import { Card, Skeleton } from "../ui";
import { ratingColor } from "../lib/rating";
import { EmptyState } from "./EmptyState";

const pct = (n: number) => `${Math.round(n)}%`;

function StatCard({
  label,
  value,
  sub,
  good,
  accent,
  wide,
}: {
  label: string;
  value: string;
  sub?: string;
  good?: boolean;
  /** Couleur custom de la valeur (prioritaire sur `good`), ex. rating via ratingColor(). */
  accent?: string;
  wide?: boolean;
}) {
  return (
    <Card className={wide ? "col-span-2 p-[18px]" : "p-[18px]"}>
      <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">{label}</div>
      <div
        className={`mt-2 font-mono text-[28px] font-extrabold tracking-tight tabular-nums ${accent ?? (good ? "text-win" : "")}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-dim">{sub}</div>}
    </Card>
  );
}

export function StatsBento({ id, range = "all" }: { id: string; range?: StatsRange }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats", id, range],
    queryFn: () => getPlayerStats(id, range),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <Card key={i} className={i === 0 ? "col-span-2 p-[18px]" : "p-[18px]"}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-20" />
          </Card>
        ))}
      </div>
    );
  }

  if (isError) return <p className="text-sm text-loss">Stats indisponibles pour le moment.</p>;

  if (!data || data.overall.matches === 0) {
    return (
      <Card className="py-2">
        <EmptyState icon={TbChartBar} title="Pas encore de stats">
          Les stats détaillées apparaîtront après quelques matchs synchronisés.
        </EmptyState>
      </Card>
    );
  }

  const o = data.overall;
  const losses = o.matches - o.wins;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard
        wide
        good
        label="Win rate"
        value={pct(o.winRate)}
        sub={`${o.wins} V · ${losses} D sur ${o.matches} matchs`}
      />
      <StatCard label="K/D" value={o.kd.toFixed(2)} good={o.kd >= 1} />
      <StatCard label="ADR" value={o.adr.toFixed(1)} />
      <StatCard label="HS %" value={pct(o.hsPercent)} />
      <StatCard label="Clutch" value={pct(o.clutchWinRate)} />
      <StatCard label="Entry" value={pct(o.entrySuccessRate)} />
      <StatCard label="Utility /match" value={String(Math.round(o.utilityDamagePerMatch))} />
      <StatCard
        label="Rating"
        value={o.rating != null ? o.rating.toFixed(2) : "—"}
        accent={o.rating != null ? ratingColor(o.rating) : undefined}
      />
    </div>
  );
}
