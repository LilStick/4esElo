import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TbArrowsUpDown } from "react-icons/tb";
import type { MoverEntry } from "@4eselo/types";
import { getMovers } from "../lib/api";
import { Avatar, Card, LevelBadge, Skeleton } from "../ui";
import { cn } from "../lib/cn";

const nameOf = (m: MoverEntry) => m.faceitNickname ?? m.discordName ?? "—";

function MoverRow({ m }: { m: MoverEntry }) {
  const up = (m.delta ?? 0) > 0;
  return (
    <Link
      to={`/player/${m.id}`}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.03]"
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
      <span className={cn("font-mono text-xl font-extrabold tabular-nums", up ? "text-win" : "text-loss")}>
        {up ? "+" : ""}
        {m.delta}
      </span>
    </Link>
  );
}

/** Widget « Mouvements récents » : liste complète des mouvements d'ELO sur 7 j, plus gros en premier. */
export function RecentMovements() {
  const { data, isLoading } = useQuery({ queryKey: ["movers", "7d"], queryFn: () => getMovers("7d") });

  const moved = (data?.movers ?? [])
    .filter((m) => m.delta != null && m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        <TbArrowsUpDown size={14} className="shrink-0 text-brand" />
        Mouvements récents
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        </div>
      ) : moved.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {moved.map((m) => (
            <MoverRow key={m.id} m={m} />
          ))}
        </div>
      ) : (
        <div className="py-2 text-sm text-ink-dim">Rien n'a bougé cette semaine.</div>
      )}
    </Card>
  );
}
