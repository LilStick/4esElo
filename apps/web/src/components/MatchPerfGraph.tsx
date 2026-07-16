import { useState } from "react";
import type { MatchSummary } from "@4eselo/types";
import { cn } from "../lib/cn";
import { fullDate } from "../lib/relativeTime";
import { matchRating, ratingColor } from "../lib/rating";
import { LevelBadge } from "../ui";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());

/** Palier Faceit (CS2) d'un ELO - pour le barème de gauche. */
function eloLevel(elo: number): number {
  if (elo >= 2001) return 10;
  if (elo >= 1851) return 9;
  if (elo >= 1701) return 8;
  if (elo >= 1551) return 7;
  if (elo >= 1401) return 6;
  if (elo >= 1251) return 5;
  if (elo >= 1101) return 4;
  if (elo >= 951) return 3;
  if (elo >= 801) return 2;
  return 1;
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

/**
 * Graphe de perf façon Faceit : chaque sommet = un match, courbe lissée + aire,
 * barème ELO/rang à gauche, bande V/D dessous alignée aux points, tooltip riche.
 * SVG viewBox 0-100 (étiré, trait constant) + overlay HTML en % → alignement net.
 */
export function MatchPerfGraph({ matches }: { matches: MatchSummary[] }) {
  const [active, setActive] = useState<number | null>(null);

  const firstKnown = matches.find((m) => m.eloAfter != null)?.eloAfter ?? null;

  if (firstKnown == null || matches.length < 2) {
    return (
      <div className="grid h-56 w-full place-items-center px-6 text-center text-sm text-ink-dim">
        La courbe se trace dès que tes matchs portent leur ELO - reviens après quelques games.
      </div>
    );
  }

  // ELO par match : back-fill des premiers manquants, puis forward-fill.
  let prev = firstKnown;
  const series = matches.map((m) => {
    if (m.eloAfter != null) prev = m.eloAfter;
    return { m, elo: prev };
  });

  const elos = series.map((s) => s.elo);
  const lo = Math.min(...elos);
  const hi = Math.max(...elos);
  const span = hi - lo || 1;
  const n = series.length;

  // Padding vertical : la courbe reste dans [PAD, 100-PAD] → sommets/creux ne débordent pas.
  const PAD = 10;
  const yOf = (elo: number) => PAD + (1 - (elo - lo) / span) * (100 - 2 * PAD);

  const pts = series.map((s, i) => ({
    x: n === 1 ? 50 : (i / (n - 1)) * 100,
    y: yOf(s.elo),
    m: s.m,
  }));

  // Barème gauche : 4 paliers d'ELO répartis, avec l'icône de rang correspondante.
  const ticks = [0, 1, 2, 3].map((i) => {
    const elo = Math.round(hi - (i / 3) * span);
    return { elo, level: eloLevel(elo), y: yOf(elo) };
  });

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
      {/* Barème ELO / rang */}
      <div className="relative w-12 shrink-0" style={{ height: "14rem" }}>
        {ticks.map((t) => (
          <div
            key={t.elo}
            className="absolute right-1 flex -translate-y-1/2 items-center gap-1"
            style={{ top: `${t.y}%` }}
          >
            <LevelBadge level={t.level} size={14} />
            <span className="font-mono text-[10px] text-ink-faint tabular-nums">{t.elo}</span>
          </div>
        ))}
      </div>

      {/* Zone plot (courbe + bande) - survol partagé : hover courbe OU pille déclenche le tooltip */}
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
                key={t.elo}
                x1={0}
                x2={100}
                y1={t.y}
                y2={t.y}
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

        {/* Bande V/D alignée aux points */}
        <div className="relative mt-2 h-2">
          {pts.map((p, i) => (
            <span
              key={p.m.matchId}
              className={cn(
                "absolute h-1.5 w-2.5 -translate-x-1/2 rounded-full transition-transform",
                p.m.result === 1 ? "bg-win" : "bg-loss",
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

function PerfTooltip({ pt }: { pt: { x: number; m: MatchSummary } }) {
  const m = pt.m;
  const s = m.stats;
  const win = m.result === 1;
  const r = matchRating(s);
  const side = pt.x > 60 ? "right" : "left";
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-2 z-20 w-44 rounded-xl border border-white/[0.1] bg-surface-2 p-3 text-xs shadow-xl",
        side === "right" ? "-translate-x-full" : "",
      )}
      style={{ left: `${pt.x}%`, marginLeft: side === "right" ? -8 : 8 }}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">{prettyMap(m.map)}</span>
        <span className={cn("font-bold", win ? "text-win" : "text-loss")}>
          {win ? "Victoire" : "Défaite"}
        </span>
      </div>
      <div className="mt-0.5 text-ink-faint">{fullDate(m.playedAt)}</div>
      <div className="mt-2 flex flex-col gap-1">
        <Row
          label="Rating"
          value={r != null ? r.toFixed(2) : "-"}
          accent={r != null ? ratingColor(r) : undefined}
        />
        <Row label="K / D / A" value={`${s.kills} / ${s.deaths} / ${s.assists}`} />
        <Row
          label="± ELO"
          value={m.eloDelta == null ? "-" : `${m.eloDelta > 0 ? "+" : ""}${m.eloDelta}`}
          accent={m.eloDelta == null ? undefined : m.eloDelta > 0 ? "text-win" : "text-loss"}
        />
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-faint">{label}</span>
      <span className={cn("font-mono font-bold tabular-nums", accent ?? "text-ink")}>{value}</span>
    </div>
  );
}
