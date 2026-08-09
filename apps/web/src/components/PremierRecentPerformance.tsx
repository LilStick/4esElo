import { useQuery } from "@tanstack/react-query";
import { TbChartLine } from "react-icons/tb";
import type { PremierMatchSummary } from "@4eselo/types";
import { getPlayerPremierMatches } from "../lib/api";
import { Card, Skeleton } from "../ui";
import { cn } from "../lib/cn";
import { fullDate } from "../lib/relativeTime";
import { PerfGraph, type PerfPoint } from "./PerfGraph";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());
const fmt = (n: number) => n.toLocaleString("en-US");
const OUTCOME: Record<PremierMatchSummary["result"], PerfPoint["outcome"]> = {
  win: "win",
  loss: "loss",
  tie: "tie",
};

/**
 * « Performances récentes » Premier (B18.26) : même graphe par-match que Faceit
 * (`PerfGraph`, un sommet = un match, pastilles V/D/N), la valeur portée étant le
 * CS Rating (`ratingAfter`, forward-fill des trous). Pas de série (absente des
 * données Premier) → récap V/D/N + amplitude du rating.
 */
export function PremierRecentPerformance({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["premierMatches", id, 30],
    queryFn: () => getPlayerPremierMatches(id, 30),
  });

  const items = data?.items ?? [];
  const chrono = [...items].reverse(); // récent à droite

  // Forward-fill du CS Rating (certains matchs peuvent ne pas porter leur rating).
  const firstKnown = chrono.find((m) => m.ratingAfter != null)?.ratingAfter ?? null;
  let prev = firstKnown ?? 0;
  const points: PerfPoint[] =
    firstKnown == null
      ? []
      : chrono.map((m) => {
          if (m.ratingAfter != null) prev = m.ratingAfter;
          const s = m.stats;
          return {
            key: m.shareCode,
            value: prev,
            outcome: OUTCOME[m.result],
            title: prettyMap(m.map),
            subtitle: fullDate(m.playedAt),
            rows: [
              { label: "CS Rating", value: m.ratingAfter != null ? fmt(m.ratingAfter) : "-" },
              { label: "K / D / A", value: `${s.kills} / ${s.deaths} / ${s.assists}` },
              { label: "ADR", value: s.adr.toFixed(0) },
            ],
          };
        });

  const wins = items.filter((m) => m.result === "win").length;
  const losses = items.filter((m) => m.result === "loss").length;
  const ties = items.filter((m) => m.result === "tie").length;
  const ratings = points.map((p) => p.value);
  const min = ratings.length ? Math.min(...ratings) : null;
  const max = ratings.length ? Math.max(...ratings) : null;
  const cur = ratings.at(-1) ?? null;
  const first = ratings.at(0) ?? null;
  const delta = first != null && cur != null ? cur - first : null;
  const pos =
    min != null && max != null && max > min && cur != null ? ((cur - min) / (max - min)) * 100 : 100;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
          <TbChartLine size={14} className="text-brand" />
          Performances récentes
        </div>
        {items.length > 0 && <div className="text-xs text-ink-faint">{items.length} derniers matchs</div>}
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <PerfGraph
              points={points}
              formatTick={fmt}
              emptyHint="La courbe se trace dès que tes matchs Premier portent leur CS Rating."
            />
          </div>

          <div className="flex shrink-0 flex-col justify-center gap-4 lg:w-56">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="w-full text-sm">
                <div className="mb-3 flex justify-center gap-2 font-mono font-bold">
                  <span className="rounded-md bg-win/12 px-2 py-0.5 text-win">V {wins}</span>
                  <span className="rounded-md bg-loss/12 px-2 py-0.5 text-loss">D {losses}</span>
                  {ties > 0 && (
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-ink-dim">N {ties}</span>
                  )}
                </div>

                <div className="mb-3">
                  <div className="flex items-baseline justify-between font-mono text-[11px] text-ink-dim tabular-nums">
                    <span>{min != null ? fmt(min) : "-"}</span>
                    <span className="text-base font-bold text-ink">{cur != null ? fmt(cur) : "-"}</span>
                    <span>{max != null ? fmt(max) : "-"}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pos}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-ink-dim">Variation rating</span>
                  <span
                    className={cn(
                      "font-mono font-bold tabular-nums",
                      (delta ?? 0) >= 0 ? "text-win" : "text-loss",
                    )}
                  >
                    {delta != null ? `${delta >= 0 ? "+" : ""}${fmt(delta)}` : "-"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
