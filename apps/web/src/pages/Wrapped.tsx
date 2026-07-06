import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { TbConfetti, TbSparkles } from "react-icons/tb";
import type { AwardKey, AwardWinner } from "@4eselo/types";
import { getWrapped } from "../lib/api";
import { parsePeriod, monthLabel } from "../lib/period";
import { Avatar, Card, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { useTitle } from "../lib/useTitle";

type Group = {
  award: AwardKey;
  emoji: string;
  title: string;
  punchline: string;
  winners: { playerId: string; nickname: string; value: number }[];
};

/** Regroupe les gagnants par award (ex æquo → une seule carte). */
function groupAwards(awards: AwardWinner[]): Group[] {
  const map = new Map<AwardKey, Group>();
  for (const a of awards) {
    const g = map.get(a.award);
    if (g) g.winners.push({ playerId: a.playerId, nickname: a.nickname, value: a.value });
    else
      map.set(a.award, {
        award: a.award,
        emoji: a.emoji,
        title: a.title,
        punchline: a.punchline,
        winners: [{ playerId: a.playerId, nickname: a.nickname, value: a.value }],
      });
  }
  return [...map.values()];
}

function AwardCard({ g, period }: { g: Group; period: string }) {
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="text-4xl leading-none">{g.emoji}</span>
        <div className="text-lg font-bold">{g.title}</div>
      </div>

      <div className="flex flex-col gap-1.5">
        {g.winners.map((w) => (
          <Link
            key={w.playerId}
            to={`/wrapped/${period}/${w.playerId}`}
            className="group flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
          >
            <Avatar name={w.nickname} size={26} />
            <span className="flex-1 truncate text-sm font-semibold transition-colors group-hover:text-brand-hi">
              {w.nickname}
            </span>
            <span className="font-mono text-xs font-bold text-brand tabular-nums">{w.value}</span>
          </Link>
        ))}
      </div>

      <p className="mt-auto text-sm text-ink-dim italic">« {g.punchline} »</p>
    </Card>
  );
}

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
              <AwardCard g={g} period={period} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
