import { useQuery } from "@tanstack/react-query";
import { TbChartLine } from "react-icons/tb";
import type { EloPoint } from "@4eselo/types";
import { getPlayerMatches } from "../lib/api";
import { Card, Skeleton } from "../ui";
import { cn } from "../lib/cn";
import { EloChart } from "./EloChart";

function longestWinStreak(chrono: number[]): number {
  let max = 0;
  let cur = 0;
  for (const r of chrono) {
    if (r === 1) {
      cur += 1;
      max = Math.max(max, cur);
    } else {
      cur = 0;
    }
  }
  return max;
}

/**
 * Bloc « Performances récentes » façon Faceit : courbe d'ELO + bandeau V/D
 * dessous, panneau récap (V/L, min/actuel/max, Δ ELO, plus longue série).
 */
export function RecentPerformance({
  id,
  history,
  elo,
}: {
  id: string;
  history: EloPoint[];
  elo: number | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["matches", id, 30],
    queryFn: () => getPlayerMatches(id, 30),
  });

  const items = data?.items ?? [];
  const wins = items.filter((m) => m.result === 1).length;
  const losses = items.length - wins;
  const chrono = [...items].reverse(); // récent à droite
  const streak = longestWinStreak(chrono.map((m) => m.result));

  const elos = history.map((h) => h.elo);
  const min = elos.length ? Math.min(...elos) : (elo ?? 0);
  const max = elos.length ? Math.max(...elos) : (elo ?? 0);
  const first = elos.at(0);
  const last = elos.at(-1);
  const delta = first != null && last != null ? last - first : null;
  const pos = max > min && elo != null ? ((elo - min) / (max - min)) * 100 : 100;

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
          {/* Courbe + bandeau de forme */}
          <div className="min-w-0 flex-1">
            <EloChart points={history} />
            {chrono.length > 0 && (
              <div className="mt-3 flex gap-1">
                {chrono.map((m) => (
                  <span
                    key={m.matchId}
                    className={cn("h-1.5 min-w-0 flex-1 rounded-full", m.result === 1 ? "bg-win" : "bg-loss")}
                    title={m.result === 1 ? "Victoire" : "Défaite"}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Récap */}
          <div className="flex shrink-0 flex-col justify-center gap-4 lg:w-56">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="w-full text-sm">
                <div className="mb-3 flex justify-center gap-2 font-mono font-bold">
                  <span className="rounded-md bg-win/12 px-2 py-0.5 text-win">V {wins}</span>
                  <span className="rounded-md bg-loss/12 px-2 py-0.5 text-loss">D {losses}</span>
                </div>

                <div className="mb-3">
                  <div className="flex items-baseline justify-between font-mono text-[11px] text-ink-dim tabular-nums">
                    <span>{min}</span>
                    <span className="text-base font-bold text-ink">{elo ?? "—"}</span>
                    <span>{max}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pos}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-ink-dim">Changement ELO</span>
                  <span
                    className={cn(
                      "font-mono font-bold tabular-nums",
                      (delta ?? 0) >= 0 ? "text-win" : "text-loss",
                    )}
                  >
                    {delta != null ? `${delta >= 0 ? "+" : ""}${delta}` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-ink-dim">Plus longue série</span>
                  <span className="font-mono font-bold tabular-nums">🔥 {streak}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
