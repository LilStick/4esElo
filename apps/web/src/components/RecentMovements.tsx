import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TbArrowsDiagonal, TbArrowsUpDown } from "react-icons/tb";
import type { MoverEntry } from "@4eselo/types";
import { getMovers } from "../lib/api";
import { Avatar, Card, LevelBadge, Modal, Skeleton } from "../ui";
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

/** Widget « Mouvements récents » : le plus gros mouvement d'ELO sur 7 j, le reste dans une modale. */
export function RecentMovements() {
  const { data, isLoading } = useQuery({ queryKey: ["movers", "7d"], queryFn: () => getMovers("7d") });
  const [open, setOpen] = useState(false);

  const moved = (data?.movers ?? []).filter((m) => m.delta != null && m.delta !== 0);
  const headliner = [...moved].sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))[0];

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
          <TbArrowsUpDown size={14} className="shrink-0 text-brand" />
          <span className="truncate">Mouvements récents</span>
        </div>
        {moved.length > 1 && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Voir tout"
            title={`Voir tout (${moved.length})`}
            className="flex shrink-0 cursor-pointer items-center gap-1 font-mono text-[11px] font-bold text-ink-dim tabular-nums transition-colors hover:text-brand-hi"
          >
            {moved.length}
            <TbArrowsDiagonal size={13} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        </div>
      ) : headliner ? (
        <MoverRow m={headliner} />
      ) : (
        <div className="py-2 text-sm text-ink-dim">Rien n'a bougé cette semaine.</div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Mouvements · 7 jours">
        {moved.map((m) => (
          <MoverRow key={m.id} m={m} />
        ))}
      </Modal>
    </Card>
  );
}
