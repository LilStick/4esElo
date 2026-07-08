import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TbArrowUp, TbArrowsExchange } from "react-icons/tb";
import type { OvertakeEntry, OvertakePlayer } from "@4eselo/types";
import { getOvertakes } from "../lib/api";
import { Avatar, Card, HoverBarList, Skeleton } from "../ui";

const nameOf = (p: OvertakePlayer) => p.faceitNickname ?? p.discordName ?? "—";

function Header() {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
      <TbArrowsExchange size={14} className="shrink-0 text-brand" />
      Dépassements récents
    </div>
  );
}

/** Widget « Dépassements récents » : qui est passé devant qui au classement sur 7 j. */
export function Overtakes() {
  const { data, isLoading } = useQuery({ queryKey: ["overtakes", "7d"], queryFn: () => getOvertakes("7d") });

  const overtakes = data?.overtakes ?? [];

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <Header />
        <Card className="flex items-center gap-3 p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        </Card>
      </section>
    );
  }

  if (overtakes.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <Header />
        <Card className="p-6 text-center text-sm text-ink-dim">
          Personne n'a doublé personne cette semaine.
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <Header />
      <Card className="p-2">
        <HoverBarList
          items={overtakes}
          rowHeight={56}
          keyOf={(o: OvertakeEntry, i) => `${o.passer.id}-${o.passed.id}-${i}`}
          children={(o: OvertakeEntry) => (
            <div className="flex w-full min-w-0 flex-col gap-1 py-1">
              <div className="flex items-center gap-2">
                <Avatar name={nameOf(o.passer)} size={24} />
                <Link
                  to={`/player/${o.passer.id}`}
                  className="truncate text-sm font-semibold text-win hover:underline"
                >
                  {nameOf(o.passer)}
                </Link>
                {o.passer.elo != null && (
                  <span className="ml-auto font-mono text-xs text-ink-faint tabular-nums">
                    {o.passer.elo}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 pl-1 text-xs text-ink-faint">
                <TbArrowUp size={12} className="shrink-0 text-win" />
                passe devant
                <Link
                  to={`/player/${o.passed.id}`}
                  className="truncate text-ink-dim hover:text-brand-hi hover:underline"
                >
                  {nameOf(o.passed)}
                </Link>
              </div>
            </div>
          )}
        />
      </Card>
    </section>
  );
}
