import { useState } from "react";
import { cn } from "../lib/cn";
import { perfScale } from "../lib/perfScale";

/** Un point du graphe de perf (un match), agnostique de la source. */
export interface PerfPoint {
  key: string;
  /** Valeur portée (ELO Faceit ou CS Rating Premier). */
  value: number;
  outcome: "win" | "loss" | "tie";
  /** Contenu du tooltip. */
  title: string;
  subtitle: string;
  rows: { label: string; value: string; accent?: string }[];
}

/** Courbe lissée (Catmull-Rom → bézier) en coords viewBox 0-100. */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const OUTCOME_PILL: Record<PerfPoint["outcome"], string> = {
  win: "bg-win",
  loss: "bg-loss",
  tie: "bg-white/40",
};

/**
 * Graphe de perf par match (B18.26) : chaque sommet = un match, courbe lissée +
 * aire, barème Y à **valeurs rondes** (via `perfScale`, dernier point ~centré),
 * bande V/D/N dessous alignée aux points, tooltip riche. Partagé Faceit + Premier.
 * SVG viewBox 0-100 (étiré, trait constant) + overlay HTML en % → alignement net.
 */
export function PerfGraph({
  points,
  formatTick = (v) => String(v),
  emptyHint,
}: {
  points: PerfPoint[];
  formatTick?: (v: number) => string;
  emptyHint?: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="grid h-56 w-full place-items-center px-6 text-center text-sm text-ink-dim">
        {emptyHint ?? "La courbe se trace dès que tu as quelques matchs - reviens après quelques games."}
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const { lo, hi, ticks } = perfScale(values);
  const n = points.length;

  const PAD = 10;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const yOf = (v: number) => clamp(PAD + (1 - (v - lo) / (hi - lo)) * (100 - 2 * PAD), PAD, 100 - PAD);

  const pts = points.map((p, i) => ({
    x: n === 1 ? 50 : (i / (n - 1)) * 100,
    y: yOf(p.value),
    p,
  }));

  const line = smoothPath(pts);
  const area = line ? `${line} L 100 100 L 0 100 Z` : "";

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    setActive(Math.max(0, Math.min(n - 1, Math.round((xPct / 100) * (n - 1)))));
  };

  const cur = active != null ? pts[active] : null;

  return (
    <div className="flex gap-2">
      {/* Barème Y (valeurs rondes) */}
      <div className="relative w-14 shrink-0" style={{ height: "14rem" }}>
        {ticks.map((t) => (
          <div key={t} className="absolute right-1 -translate-y-1/2" style={{ top: `${yOf(t)}%` }}>
            <span className="font-mono text-[10px] text-ink-faint tabular-nums">{formatTick(t)}</span>
          </div>
        ))}
      </div>

      {/* Zone plot (courbe + bande) */}
      <div className="relative flex-1" onMouseMove={onMove} onMouseLeave={() => setActive(null)}>
        <div className="relative h-56">
          <svg
            className="absolute inset-0 size-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5E8BFF" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#5E8BFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={100}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke="rgba(255,255,255,0.03)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area} fill="url(#perf-fill)" />
            <path
              d={line}
              fill="none"
              stroke="#5E8BFF"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {cur && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-white/15"
              style={{ left: `${cur.x}%` }}
            />
          )}
          {cur && (
            <span
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-brand-hi shadow-[0_0_10px_rgba(94,139,255,0.6)]"
              style={{ left: `${cur.x}%`, top: `${cur.y}%` }}
            />
          )}
          {cur && <PerfTooltip pt={cur} />}
        </div>

        {/* Bande V/D/N alignée aux points */}
        <div className="relative mt-2 h-2">
          {pts.map((p, i) => (
            <span
              key={p.p.key}
              className={cn(
                "absolute h-1.5 w-2.5 -translate-x-1/2 rounded-full transition-transform",
                OUTCOME_PILL[p.p.outcome],
                active === i ? "scale-125" : "opacity-80",
              )}
              style={{ left: `${p.x}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const OUTCOME_LABEL: Record<PerfPoint["outcome"], { text: string; cls: string }> = {
  win: { text: "Victoire", cls: "text-win" },
  loss: { text: "Défaite", cls: "text-loss" },
  tie: { text: "Égalité", cls: "text-ink-dim" },
};

function PerfTooltip({ pt }: { pt: { x: number; p: PerfPoint } }) {
  const { p } = pt;
  const side = pt.x > 60 ? "right" : "left";
  const outcome = OUTCOME_LABEL[p.outcome];
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-2 z-20 w-44 rounded-xl border border-white/[0.1] bg-surface-2 p-3 text-xs shadow-xl",
        side === "right" ? "-translate-x-full" : "",
      )}
      style={{ left: `${pt.x}%`, marginLeft: side === "right" ? -8 : 8 }}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">{p.title}</span>
        <span className={cn("font-bold", outcome.cls)}>{outcome.text}</span>
      </div>
      <div className="mt-0.5 text-ink-faint">{p.subtitle}</div>
      <div className="mt-2 flex flex-col gap-1">
        {p.rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-ink-faint">{r.label}</span>
            <span className={cn("font-mono font-bold tabular-nums", r.accent ?? "text-ink")}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
