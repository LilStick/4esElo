import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { TbChartBar } from "react-icons/tb";
import type { StatsRange } from "@4eselo/types";
import { getPlayerStats } from "../lib/api";
import { Card, CountUp, Skeleton } from "../ui";
import { ratingColor } from "../lib/rating";
import { EmptyState } from "./EmptyState";

const pct = (n: number) => `${Math.round(n)}%`;

/** Entrée d'une tuile (fondu + montée), orchestrée en cascade par le conteneur. */
const tileVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as const } },
};

function StatCard({
  label,
  value,
  format,
  sub,
  subInline,
  good,
  accent,
  wide,
}: {
  label: string;
  /** null → « — » (pas de count-up). */
  value: number | null;
  format?: (n: number) => string;
  sub?: string;
  /** Affiche `sub` à droite de la valeur (au lieu de dessous). */
  subInline?: boolean;
  good?: boolean;
  /** Couleur custom de la valeur (prioritaire sur `good`). */
  accent?: string;
  wide?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={tileVariants}
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={wide ? "col-span-2" : undefined}
    >
      <Card className="p-[18px]">
        <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">{label}</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`font-mono text-[28px] font-extrabold tracking-tight tabular-nums ${accent ?? (good ? "text-win" : "")}`}
          >
            {value == null ? "—" : <CountUp value={value} format={format} />}
          </span>
          {sub && subInline && <span className="text-xs text-ink-dim">{sub}</span>}
        </div>
        {sub && !subInline && <div className="mt-1 text-xs text-ink-dim">{sub}</div>}
      </Card>
    </motion.div>
  );
}

export function StatsBento({ id, range = "all" }: { id: string; range?: StatsRange }) {
  const reduce = useReducedMotion();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats", id, range],
    queryFn: () => getPlayerStats(id, range),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Card key={i} className="p-[18px]">
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
    <motion.div
      className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      <StatCard
        good
        subInline
        label="Win rate"
        value={o.winRate}
        format={pct}
        sub={`${o.wins}V · ${losses}D`}
      />
      <StatCard label="K/D" value={o.kd} format={(n) => n.toFixed(2)} good={o.kd >= 1} />
      <StatCard label="ADR" value={o.adr} format={(n) => n.toFixed(1)} />
      <StatCard label="HS %" value={o.hsPercent} format={pct} />
      <StatCard label="Clutch" value={o.clutchWinRate} format={pct} />
      <StatCard label="Entry" value={o.entrySuccessRate} format={pct} />
      <StatCard
        label="Utility /match"
        value={o.utilityDamagePerMatch}
        format={(n) => String(Math.round(n))}
      />
      <StatCard
        label="Rating"
        value={o.rating}
        format={(n) => n.toFixed(2)}
        accent={o.rating != null ? ratingColor(o.rating) : undefined}
      />
    </motion.div>
  );
}
