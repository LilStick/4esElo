import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TbArrowsUpDown } from "react-icons/tb";
import type { MoverEntry } from "@4eselo/types";
import { getMovers } from "../lib/api";
import { Avatar, Card, LevelBadge, Skeleton } from "../ui";
import { cn } from "../lib/cn";

const nameOf = (m: MoverEntry) => m.faceitNickname ?? m.discordName ?? "—";

/** Garde au plus 6 mouvements : les 3 plus grosses montées + les 3 plus grosses chutes. */
function pick(movers: MoverEntry[]): MoverEntry[] {
  const moved = movers.filter((m) => m.delta != null && m.delta !== 0);
  if (moved.length <= 6) return moved;
  return [...moved.slice(0, 3), ...moved.slice(-3)];
}

/** Widget « Mouvements récents » : plus grosses montées/descentes d'ELO sur 7 jours. */
export function RecentMovements() {
  const { data, isLoading } = useQuery({
    queryKey: ["movers", "7d"],
    queryFn: () => getMovers("7d"),
  });

  const moves = pick(data?.movers ?? []);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        <TbArrowsUpDown size={14} className="text-brand" />
        Mouvements récents
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      ) : moves.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {moves.map((m) => {
            const up = (m.delta ?? 0) > 0;
            return (
              <Link
                key={m.id}
                to={`/player/${m.id}`}
                className="group flex items-center gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/[0.03]"
              >
                <Avatar name={nameOf(m)} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold transition-colors group-hover:text-brand-hi">
                      {nameOf(m)}
                    </span>
                    <LevelBadge level={m.level} size={18} />
                  </div>
                  <div className="text-xs text-ink-faint">{m.elo ?? "—"} ELO</div>
                </div>
                <span
                  className={cn(
                    "font-mono text-xl font-extrabold tabular-nums",
                    up ? "text-win" : "text-loss",
                  )}
                >
                  {up ? "+" : ""}
                  {m.delta}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-2 text-sm text-ink-dim">Rien n'a bougé cette semaine.</div>
      )}
    </Card>
  );
}
