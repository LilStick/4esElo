import type { MatchSummary } from "@4eselo/types";
import { fullDate } from "../lib/relativeTime";
import { matchRating, ratingColor } from "../lib/rating";
import { LevelBadge } from "../ui";
import { PerfGraph, type PerfPoint } from "./PerfGraph";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());

/** Palier Faceit officiel (level 10 = 2001+, donc 2000 = niveau 9) — mêmes bornes
 *  que `eloToLevel` back (source de vérité). */
function eloLevel(elo: number): number {
  const bounds = [800, 950, 1100, 1250, 1400, 1550, 1700, 1850, 2000];
  const idx = bounds.findIndex((b) => elo <= b);
  return idx === -1 ? 10 : idx + 1;
}

/**
 * Graphe de perf Faceit : adapte les matchs (avec forward-fill de l'ELO manquant)
 * en points génériques pour `PerfGraph`. Barème gauche = palier Faceit + ELO rond.
 */
export function MatchPerfGraph({ matches }: { matches: MatchSummary[] }) {
  const firstKnown = matches.find((m) => m.eloAfter != null)?.eloAfter ?? null;

  if (firstKnown == null || matches.length < 2) {
    return (
      <PerfGraph
        points={[]}
        emptyHint="La courbe se trace dès que tes matchs portent leur ELO - reviens après quelques games."
      />
    );
  }

  // ELO par match : back-fill des premiers manquants, puis forward-fill.
  let prev = firstKnown;
  const points: PerfPoint[] = matches.map((m) => {
    if (m.eloAfter != null) prev = m.eloAfter;
    const r = matchRating(m.stats);
    return {
      key: m.matchId,
      value: prev,
      outcome: m.result === 1 ? "win" : "loss",
      title: prettyMap(m.map),
      subtitle: fullDate(m.playedAt),
      rows: [
        {
          label: "Rating",
          value: r != null ? r.toFixed(2) : "-",
          accent: r != null ? ratingColor(r) : undefined,
        },
        { label: "K / D / A", value: `${m.stats.kills} / ${m.stats.deaths} / ${m.stats.assists}` },
        {
          label: "± ELO",
          value: m.eloDelta == null ? "-" : `${m.eloDelta > 0 ? "+" : ""}${m.eloDelta}`,
          accent: m.eloDelta == null ? undefined : m.eloDelta > 0 ? "text-win" : "text-loss",
        },
      ],
    };
  });

  return (
    <PerfGraph
      points={points}
      renderTick={(v) => (
        <div className="flex items-center gap-1">
          <LevelBadge level={eloLevel(v)} size={14} />
          <span className="font-mono text-[10px] text-ink-faint tabular-nums">{v}</span>
        </div>
      )}
    />
  );
}
