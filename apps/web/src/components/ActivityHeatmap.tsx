import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TbActivity } from "react-icons/tb";
import { getActivity, getPlayerActivity } from "../lib/api";
import { Card, Skeleton } from "../ui";
import { cn } from "../lib/cn";

const DAYS = 364; // 52 semaines pleines
const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7; // lundi = 0 … dimanche = 6

function level(n: number): string {
  if (n === 0) return "bg-white/[0.05]";
  if (n <= 1) return "bg-brand/30";
  if (n <= 3) return "bg-brand/60";
  return "bg-brand";
}

type Cell = { date: Date; count: number } | null;
type Hover = { count: number; date: Date; x: number; y: number };

/**
 * Heatmap d'activité façon GitHub sur 52 semaines (B5.3, données `/activity`).
 * Sans `id` = pôle entier (un match partagé compte une fois, dédupliqué côté API).
 */
export function ActivityHeatmap({ id, title = "Activité" }: { id?: string; title?: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity", id ?? "pole", DAYS],
    queryFn: () => (id ? getPlayerActivity(id, DAYS) : getActivity(DAYS)),
  });
  const [hover, setHover] = useState<Hover | null>(null);

  const { weeks, months, total } = useMemo(() => {
    // day = "YYYY-MM-DD" (UTC) → parsé sans suffixe "Z" pour rester en heure locale
    // (évite un décalage d'un jour sur la grille par rapport à `today`, lui aussi local).
    const counts = new Map<string, number>();
    for (const a of data?.activity ?? []) {
      counts.set(dayKey(new Date(`${a.day}T00:00:00`)), a.matches);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cells: Cell[] = [];
    const firstDate = new Date(today);
    firstDate.setDate(today.getDate() - (DAYS - 1));
    for (let p = 0; p < mondayIndex(firstDate); p++) cells.push(null); // padding début de semaine
    let total = 0;
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const count = counts.get(dayKey(d)) ?? 0;
      total += count;
      cells.push({ date: d, count });
    }
    const weeks: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    // Label de mois : sur la 1re colonne qui entame un nouveau mois.
    let last = -1;
    const months = weeks.map((col) => {
      const c = col.find(Boolean) as Exclude<Cell, null> | undefined;
      if (!c) return "";
      const m = c.date.getMonth();
      if (m === last) return "";
      last = m;
      return c.date.toLocaleDateString("fr-FR", { month: "short" });
    });
    return { weeks, months, total };
  }, [data]);

  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-28 w-full" />
      </Card>
    );
  }
  if (isError) return null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
          <TbActivity size={14} className="text-brand" />
          {title} · 52 semaines
        </span>
        <span className="text-xs text-ink-dim">{total} matchs</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex">
          {/* Labels jours */}
          <div className="mr-2 flex flex-col gap-[3px] pt-[18px] text-[10px] text-ink-faint">
            {WEEKDAYS.map((d) => (
              <span key={d} className="h-[13px] leading-[13px]">
                {d}
              </span>
            ))}
          </div>

          <div>
            {/* Labels mois */}
            <div className="mb-[5px] flex h-[13px] gap-[3px] text-[10px] text-ink-faint">
              {months.map((m, i) => (
                <span key={i} className="w-[13px] whitespace-nowrap">
                  {m}
                </span>
              ))}
            </div>

            {/* Grille */}
            <div className="flex gap-[3px]">
              {weeks.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }, (_, ri) => {
                    const cell = col[ri];
                    if (!cell) return <span key={ri} className="size-[13px]" />;
                    return (
                      <span
                        key={ri}
                        className={cn(
                          "size-[13px] rounded-[3px] transition-transform hover:scale-110",
                          level(cell.count),
                        )}
                        onMouseEnter={(e) =>
                          setHover({ count: cell.count, date: cell.date, x: e.clientX, y: e.clientY })
                        }
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-ink-faint">
        <span>Moins</span>
        <span className="size-[13px] rounded-[3px] bg-white/[0.05]" />
        <span className="size-[13px] rounded-[3px] bg-brand/30" />
        <span className="size-[13px] rounded-[3px] bg-brand/60" />
        <span className="size-[13px] rounded-[3px] bg-brand" />
        <span>Plus</span>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/12 bg-[#11141b] px-2.5 py-1.5 text-center shadow-xl"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <div className="font-mono text-xs font-bold text-ink">{hover.date.toLocaleDateString("fr-FR")}</div>
          <div className="text-[11px] text-ink-dim">
            {hover.count} match{hover.count > 1 ? "s" : ""}
          </div>
        </div>
      )}
    </Card>
  );
}
