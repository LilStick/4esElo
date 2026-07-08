import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TbTrendingUp } from "react-icons/tb";
import type { MoverEntry } from "@4eselo/types";
import { getMovers } from "../lib/api";
import { Avatar, Card, LevelBadge, Skeleton } from "../ui";

const nameOf = (m: MoverEntry) => m.faceitNickname ?? m.discordName ?? "—";

/** Widget « Grimpeur de la semaine » : plus gros gain d'ELO sur 7 jours. */
export function TopClimber() {
  const { data, isLoading } = useQuery({ queryKey: ["movers", "7d"], queryFn: () => getMovers("7d") });
  const best = (data?.movers ?? []).filter((m) => m.delta != null && m.delta > 0)[0];

  return (
    <section className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        <TbTrendingUp size={14} className="text-brand" />
        Grimpeur de la semaine
      </div>

      {isLoading ? (
        <Card className="flex items-center gap-3 p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        </Card>
      ) : best ? (
        <Card className="p-4">
          <Link to={`/player/${best.id}`} className="group flex cursor-pointer items-center gap-3">
            <Avatar name={nameOf(best)} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold transition-colors group-hover:text-brand-hi">
                  {nameOf(best)}
                </span>
                <LevelBadge level={best.level} size={18} />
              </div>
              <div className="text-xs text-ink-faint">{best.elo ?? "—"} ELO</div>
            </div>
            <span className="font-mono text-xl font-extrabold text-win tabular-nums">+{best.delta}</span>
          </Link>
        </Card>
      ) : (
        <Card className="p-6 text-center text-sm text-ink-dim">Personne n'a grimpé cette semaine.</Card>
      )}
    </section>
  );
}
