import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { TbConfetti, TbSparkles } from "react-icons/tb";
import { getWrapped } from "../lib/api";
import { groupAwards } from "../lib/awards";
import { parsePeriod, monthLabel } from "../lib/period";
import { Card, Skeleton } from "../ui";
import { AwardCard } from "../components/AwardCard";
import { EmptyState } from "../components/EmptyState";
import { MapBackdrop } from "../components/MapBackdrop";
import { useTitle } from "../lib/useTitle";
import heroScreen from "../assets/maps/screens/de_inferno.png";

export function Wrapped() {
  const { period = "" } = useParams();
  const d = parsePeriod(period);
  const title = d ? monthLabel(d.year, d.month) : period;
  useTitle(`Wrapped · ${title}`);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["wrapped", d?.year, d?.month],
    queryFn: () => getWrapped(d!.year, d!.month),
    enabled: !!d,
  });

  const groups = useMemo(() => (data ? groupAwards(data.awards) : []), [data]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Hero compact */}
      <Card className="relative overflow-hidden p-5">
        <MapBackdrop src={heroScreen} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand/15 via-transparent to-transparent"
        />
        <div className="relative flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-brand">
            <TbConfetti size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Wrapped du pôle</h1>
            <p className="text-sm text-ink-dim capitalize">{title}</p>
          </div>
        </div>
      </Card>

      {!d && (
        <EmptyState icon={TbSparkles} title="Période invalide">
          L'adresse du Wrapped doit ressembler à « juillet-2026 ».
        </EmptyState>
      )}

      {d && isLoading && (
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

      {d && isError && <p className="text-loss">Impossible de charger le Wrapped.</p>}

      {d && data && groups.length === 0 && (
        <EmptyState icon={TbSparkles} title="Pas encore d'awards">
          Personne n'a assez joué ce mois-ci pour décrocher un award.
        </EmptyState>
      )}

      {groups.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4">
          {groups.map((g) => (
            <div key={g.award} className="w-full sm:w-[320px]">
              <AwardCard g={g} linkTo={(id) => `/wrapped/${period}/${id}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
