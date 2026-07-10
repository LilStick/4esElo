import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { TbActivity } from "react-icons/tb";
import { getActivity, getPlayerActivity } from "../lib/api";
import { Card, Skeleton } from "../ui";
import { cn } from "../lib/cn";

const FETCH_DAYS = 364; // on récupère l'année, on n'affiche que ce qui rentre
const GAP = 3;
const MONTH_ROW = 18; // hauteur libellés mois (13) + marge (5)
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
 * Heatmap d'activité façon GitHub (B5.3/B5.10, données `/activity`), taille de
 * carreau fixe : on n'affiche que le nombre de semaines récentes qui rentrent
 * dans la largeur (mesurée) → pas de scroll H/V. Le home a des carreaux plus
 * gros que le profil (rail étroit). Labels jours + mois toujours visibles.
 */
export function ActivityHeatmap({ id, title = "Activité" }: { id?: string; title?: string }) {
  const cell = id ? 13 : 15; // profil (rail étroit) plus petit ; home plus grand
  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity", id ?? "pole", FETCH_DAYS],
    queryFn: () => (id ? getPlayerActivity(id, FETCH_DAYS) : getActivity(FETCH_DAYS)),
  });
  const [hover, setHover] = useState<Hover | null>(null);

  // Nombre de semaines affichables selon la largeur dispo (mesurée).
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(8);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setCols(Math.max(4, Math.min(52, Math.floor((w + GAP) / (cell + GAP)))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cell]);

  const allWeeks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of data?.activity ?? []) {
      counts.set(dayKey(new Date(`${a.day}T00:00:00`)), a.matches);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cells: Cell[] = [];
    const firstDate = new Date(today);
    firstDate.setDate(today.getDate() - (FETCH_DAYS - 1));
    for (let p = 0; p < mondayIndex(firstDate); p++) cells.push(null);
    for (let i = FETCH_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      cells.push({ date: d, count: counts.get(dayKey(d)) ?? 0 });
    }
    const weeks: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [data]);

  // Fenêtre récente : les `cols` dernières semaines.
  const weeks = allWeeks.slice(-cols);
  let lastMonth = -1;
  const months = weeks.map((col) => {
    const c = col.find(Boolean) as Exclude<Cell, null> | undefined;
    if (!c) return "";
    const m = c.date.getMonth();
    if (m === lastMonth) return "";
    lastMonth = m;
    return c.date.toLocaleDateString("fr-FR", { month: "short" });
  });
  const total = weeks.reduce((s, col) => s + col.reduce((a, c) => a + (c?.count ?? 0), 0), 0);

  const header = (extra?: ReactNode) => (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        <TbActivity size={14} className="text-brand" />
        {title}
      </span>
      {extra}
    </div>
  );

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        {header()}
        <Card className="p-4">
          <Skeleton className="h-28 w-full" />
        </Card>
      </section>
    );
  }
  if (isError) return null;

  return (
    <section className="flex flex-col gap-3">
      {header(<span className="text-xs text-ink-dim">{total} matchs</span>)}

      <Card className="p-4">
        <div className="flex">
          {/* Labels jours */}
          <div
            className="mr-2 flex flex-col text-[10px] text-ink-faint"
            style={{ gap: GAP, paddingTop: MONTH_ROW }}
          >
            {WEEKDAYS.map((d) => (
              <span key={d} className="leading-none" style={{ height: cell }}>
                {d}
              </span>
            ))}
          </div>

          {/* Zone grille (mesurée) — overflow-hidden pour que rien ne dépasse la card */}
          <div ref={gridRef} className="min-w-0 flex-1 overflow-hidden">
            {/* Labels mois (texte débordant à droite → lisible) */}
            <div className="flex text-[10px] text-ink-faint" style={{ gap: GAP, height: MONTH_ROW }}>
              {months.map((m, i) => (
                <span key={i} className="relative" style={{ width: cell }}>
                  {m && <span className="absolute left-0 whitespace-nowrap">{m}</span>}
                </span>
              ))}
            </div>

            {/* Grille */}
            <div className="flex" style={{ gap: GAP }}>
              {weeks.map((col, ci) => (
                <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
                  {Array.from({ length: 7 }, (_, ri) => {
                    const c = col[ri];
                    if (!c) return <span key={ri} style={{ width: cell, height: cell }} />;
                    return (
                      <span
                        key={ri}
                        className={cn("rounded-[2px] transition-transform hover:scale-110", level(c.count))}
                        style={{ width: cell, height: cell }}
                        onMouseEnter={(e) =>
                          setHover({ count: c.count, date: c.date, x: e.clientX, y: e.clientY })
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

        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-ink-faint">
          <span>Moins</span>
          <span className="size-[11px] rounded-[2px] bg-white/[0.05]" />
          <span className="size-[11px] rounded-[2px] bg-brand/30" />
          <span className="size-[11px] rounded-[2px] bg-brand/60" />
          <span className="size-[11px] rounded-[2px] bg-brand" />
          <span>Plus</span>
        </div>

        {hover && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/12 bg-[#11141b] px-2.5 py-1.5 text-center shadow-xl"
            style={{ left: hover.x, top: hover.y - 8 }}
          >
            <div className="font-mono text-xs font-bold text-ink">
              {hover.date.toLocaleDateString("fr-FR")}
            </div>
            <div className="text-[11px] text-ink-dim">
              {hover.count} match{hover.count > 1 ? "s" : ""}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
