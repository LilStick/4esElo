import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { TbConfetti, TbSparkles } from "react-icons/tb";
import { getBigWrapped } from "../lib/api";
import { groupAwards } from "../lib/awards";
import { parseBigPeriod, bigPeriodLabel } from "../lib/period";
import { Card, CountUp, Skeleton } from "../ui";
import { AwardCard } from "../components/AwardCard";
import { EmptyState } from "../components/EmptyState";
import { MapBackdrop } from "../components/MapBackdrop";
import { useTitle } from "../lib/useTitle";
import heroScreen from "../assets/maps/screens/de_mirage.png";

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <CountUp
        value={value}
        className="block font-mono text-3xl font-extrabold tabular-nums text-brand sm:text-4xl"
      />
      <div className="mt-1 text-[10px] tracking-[0.16em] text-ink-faint uppercase">{label}</div>
    </div>
  );
}

export function WrappedBig() {
  const { period = "" } = useParams();
  const p = parseBigPeriod(period);
  const label = p ? bigPeriodLabel(p) : period;
  useTitle(`BIG Wrapped · ${label}`);

  const reduce = useReducedMotion();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["big-wrapped", period],
    queryFn: () => getBigWrapped(period),
    enabled: !!p,
  });

  const groups = useMemo(() => (data ? groupAwards(data.awards) : []), [data]);
  const winnerCount = useMemo(() => (data ? new Set(data.awards.map((a) => a.playerId)).size : 0), [data]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {!p && (
        <EmptyState icon={TbSparkles} title="Période invalide">
          L'adresse du BIG Wrapped doit ressembler à « 2026 » ou « 2026-H1 ».
        </EmptyState>
      )}

      {p && (
        <>
          {/* Hero splashy */}
          <Card className="relative overflow-hidden p-7 text-center sm:p-10">
            <MapBackdrop src={heroScreen} />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand/20 via-brand/[0.06] to-transparent"
            />
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative flex flex-col items-center gap-3"
            >
              <span className="grid size-14 place-items-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-brand">
                <TbConfetti size={28} />
              </span>
              <div>
                <div className="text-[11px] font-bold tracking-[0.24em] text-brand uppercase">
                  BIG Wrapped
                </div>
                <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
                  Le pôle en {label}
                </h1>
              </div>
              {groups.length > 0 && (
                <div className="mt-4 flex items-center gap-8">
                  <HeroStat value={groups.length} label="Awards" />
                  <HeroStat value={winnerCount} label="Primés" />
                </div>
              )}
            </motion.div>
          </Card>

          {isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Card key={i} className="p-5">
                  <Skeleton className="size-10 rounded-lg" />
                  <Skeleton className="mt-3 h-4 w-32" />
                  <Skeleton className="mt-3 h-8 w-full rounded-lg" />
                </Card>
              ))}
            </div>
          )}

          {isError && <p className="text-loss">Impossible de charger le BIG Wrapped.</p>}

          {data && groups.length === 0 && (
            <EmptyState icon={TbSparkles} title="Pas encore d'awards">
              Personne n'a assez joué sur cette période pour décrocher un award.
            </EmptyState>
          )}

          {groups.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4">
              {groups.map((g, i) => (
                <motion.div
                  key={g.award}
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.35, ease: "easeOut", delay: Math.min(i * 0.05, 0.3) }}
                  className="w-full sm:w-[320px]"
                >
                  <AwardCard g={g} linkTo={(id) => `/wrapped/big/${period}/${id}`} />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
