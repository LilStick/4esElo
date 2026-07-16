import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { TbChartRadar, TbGitCompare } from "react-icons/tb";
import type { StatsAggregate, StatsRange } from "@4eselo/types";
import { getPlayerStats } from "../lib/api";
import { Card, InfoTip, Skeleton } from "../ui";
import { EmptyState } from "./EmptyState";

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Tooltip du radar : titre lisible + vraie valeur + explication (pas la valeur normalisée). */
function RadarTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { full: string; value: string; desc: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="max-w-[220px] rounded-lg border border-white/[0.1] bg-surface-2 px-2.5 py-1.5 text-xs shadow-xl">
      <div>
        <span className="font-semibold text-ink-dim">{p.full}</span>{" "}
        <span className="font-mono font-bold text-brand-hi">{p.value}</span>
      </div>
      <div className="mt-0.5 text-ink-faint">{p.desc}</div>
    </div>
  );
}

/**
 * Chaque axe est ramené sur 0-100 pour le radar (`v`) ; `value` reste la vraie stat lisible.
 * `axis` = libellé court (autour du radar), `full` = libellé complet, `desc` = explication.
 * - Précision = HS% · Impact = K/D remis à l'échelle (0.6 → 0, 1.6 → 100)
 * - Clutch / Entrées / Victoires = taux déjà en 0-100 · Utilité = dégâts/match (120 = plafond)
 */
function buildAxes(o: StatsAggregate) {
  return [
    {
      axis: "Précision",
      full: "Précision (HS %)",
      desc: "Part de tes kills réalisés en headshot.",
      v: clamp(o.hsPercent),
      value: `${Math.round(o.hsPercent)}%`,
    },
    {
      axis: "Impact",
      full: "Impact (K/D)",
      desc: "Ratio kills / morts moyen. Au-dessus de 1, tu fais plus de kills que de morts.",
      v: clamp(((o.kd - 0.6) / 1.0) * 100),
      value: o.kd.toFixed(2),
    },
    {
      axis: "Clutch",
      full: "Clutchs gagnés %",
      desc: "Rounds gagnés en dernier survivant face à un ou plusieurs adversaires (1vX).",
      v: clamp(o.clutchWinRate),
      value: `${Math.round(o.clutchWinRate)}%`,
    },
    {
      axis: "Entrées",
      full: "Entrées gagnées %",
      desc: "Duels d'ouverture gagnés : le premier contact du round tourne en ta faveur.",
      v: clamp(o.entrySuccessRate),
      value: `${Math.round(o.entrySuccessRate)}%`,
    },
    {
      axis: "Utilité",
      full: "Dégâts utilitaire / match",
      desc: "Dégâts infligés avec les grenades (molotov, HE) en moyenne par match.",
      v: clamp((o.utilityDamagePerMatch / 120) * 100),
      value: String(Math.round(o.utilityDamagePerMatch)),
    },
    {
      axis: "Victoires",
      full: "Taux de victoire",
      desc: "Part de matchs gagnés sur la période.",
      v: clamp(o.winRate),
      value: `${Math.round(o.winRate)}%`,
    },
  ];
}

export function RadarPerf({ id, range = "all" }: { id: string; range?: StatsRange }) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats", id, range],
    queryFn: () => getPlayerStats(id, range),
  });

  if (isLoading) {
    return (
      <Card className="grid h-[300px] place-items-center p-5">
        <Skeleton className="size-52 rounded-full" />
      </Card>
    );
  }

  if (isError) return <p className="text-sm text-loss">Radar indisponible.</p>;

  if (!data || data.overall.matches === 0) {
    return (
      <Card className="py-2">
        <EmptyState icon={TbChartRadar} title="Pas encore de radar">
          Il se dessinera après quelques matchs synchronisés.
        </EmptyState>
      </Card>
    );
  }

  const rows = buildAxes(data.overall);

  return (
    <Card className="relative flex flex-col items-center gap-6 p-4 md:flex-row md:justify-center md:gap-10">
      <button
        onClick={() => navigate(`/compare?a=${id}`)}
        aria-label="Comparer ce joueur"
        title="Comparer"
        className="absolute top-3 left-3 z-10 grid size-9 cursor-pointer place-items-center rounded-lg border border-white/[0.12] bg-white/[0.04] text-ink-dim transition-colors hover:border-brand hover:text-brand-hi focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
      >
        <TbGitCompare size={17} />
      </button>
      <div className="h-[280px] w-full max-w-[320px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={rows} outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "#8b90a0", fontSize: 12 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip content={<RadarTip />} cursor={false} />
            <Radar
              dataKey="v"
              stroke="#5E8BFF"
              strokeWidth={2}
              fill="#5E8BFF"
              fillOpacity={0.22}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex w-full flex-col justify-center gap-3 md:w-60">
        {rows.map((r) => (
          <div key={r.axis} className="flex items-center gap-2">
            <span className="flex w-28 shrink-0 items-center gap-1 text-xs text-ink-dim">
              <span className="truncate">{r.full}</span>
              <InfoTip text={r.desc} className="shrink-0" />
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${r.v}%` }} />
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-sm font-semibold tabular-nums">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
