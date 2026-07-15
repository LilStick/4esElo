import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { TbTrophy } from "react-icons/tb";
import type { BenchmarkStatKey, StatsRange } from "@4eselo/types";
import { getPlayerBenchmark } from "../lib/api";
import { Card, CountUp, Skeleton } from "../ui";
import { EmptyState } from "./EmptyState";

/** Nb de matchs minimum pour être classé (miroir de MIN_BENCHMARK_MATCHES côté API). */
const MIN_MATCHES = 10;

const pct = (n: number) => `${Math.round(n)}%`;

/** Libellé + format d'affichage de chaque stat classée (ordre = ordre d'affichage). */
const STATS: { key: BenchmarkStatKey; label: string; format: (n: number) => string }[] = [
  { key: "winRate", label: "Win rate", format: pct },
  { key: "kd", label: "K/D", format: (n) => n.toFixed(2) },
  { key: "adr", label: "ADR", format: (n) => n.toFixed(1) },
  { key: "hsPercent", label: "HS %", format: pct },
  { key: "clutchWinRate", label: "Clutch", format: pct },
  { key: "entrySuccessRate", label: "Entry", format: pct },
];

/** percentile 0-100 (plus haut = mieux) → rang « top X% » lisible (jamais « top 0% »). */
const topPercent = (percentile: number) => Math.max(1, Math.round(100 - percentile));

/** Habillage par palier : élite (top 10 %) doré/vert, fort (top 25 %) bleu, sinon neutre. */
function tier(top: number) {
  if (top <= 10) return { pill: "bg-win/15 text-win", bar: "from-win/60 to-win" };
  if (top <= 25) return { pill: "bg-brand/15 text-brand-hi", bar: "from-brand to-brand-hi" };
  return { pill: "bg-white/[0.06] text-ink-dim", bar: "from-white/15 to-white/30" };
}

const tileVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as const } },
};

export function PlayerBenchmark({ id, range = "all" }: { id: string; range?: StatsRange }) {
  const reduce = useReducedMotion();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["benchmark", id, range],
    queryFn: () => getPlayerBenchmark(id, range),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: STATS.length }, (_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="mt-3 h-7 w-16" />
          </Card>
        ))}
      </div>
    );
  }

  if (isError) return <p className="text-sm text-loss">Benchmark indisponible pour le moment.</p>;

  // Pas assez de matchs sur la fenêtre → pas de percentile fiable, on l'explique.
  if (!data || !data.qualified) {
    return (
      <Card className="py-2">
        <EmptyState icon={TbTrophy} title="Pas encore classé">
          Il faut au moins {MIN_MATCHES} matchs sur cette période pour situer ta place dans l'asso
          {data ? ` (tu en as ${data.matches})` : ""}.
        </EmptyState>
      </Card>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {STATS.map(({ key, label, format }) => {
        const stat = data.stats[key];
        // qualified ⇒ percentile non-null (garde défensive pour le typage).
        const p = stat.percentile ?? 0;
        const top = topPercent(p);
        const t = tier(top);
        return (
          <motion.div
            key={key}
            variants={tileVariants}
            whileHover={reduce ? undefined : { y: -2 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <Card className="relative flex flex-col gap-2 overflow-hidden p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
                  {label}
                </span>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${t.pill}`}>Top {top}%</span>
              </div>
              <span className="font-mono text-[26px] font-extrabold tracking-tight tabular-nums">
                <CountUp value={stat.value} format={format} />
              </span>
              {/* accent-bar dégradée en bas : longueur = percentile (plus long = mieux placé) */}
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.05]">
                <motion.span
                  className={`block h-full bg-gradient-to-r ${t.bar}`}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${p}%` }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                />
              </span>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
