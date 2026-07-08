import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { TbArrowsUpDown } from "react-icons/tb";
import type { MoverEntry } from "@4eselo/types";
import { getMovers } from "../lib/api";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Card, HoverBarList, LevelBadge, Skeleton } from "../ui";
import { cn } from "../lib/cn";

const nameOf = (m: MoverEntry) => m.faceitNickname ?? m.discordName ?? "—";

function Header() {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
      <TbArrowsUpDown size={14} className="shrink-0 text-brand" />
      Mouvements récents
    </div>
  );
}

/** Widget « Mouvements récents » : liste complète des mouvements d'ELO sur 7 j, plus gros en premier. */
export function RecentMovements() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["movers", "7d"], queryFn: () => getMovers("7d") });

  const moved = (data?.movers ?? [])
    .filter((m) => m.delta != null && m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));

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

  if (moved.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <Header />
        <Card className="p-6 text-center text-sm text-ink-dim">Rien n'a bougé cette semaine.</Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <Header />
      <Card className="p-2">
        <HoverBarList
          items={moved}
          rowHeight={60}
          keyOf={(m) => m.id}
          onSelect={(m) => navigate(`/player/${m.id}`)}
          children={(m) => {
            const up = (m.delta ?? 0) > 0;
            return (
              <>
                <Avatar name={nameOf(m)} size={40} src={discordAvatarUrl(m.discordId, m.discordAvatar)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{nameOf(m)}</span>
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
              </>
            );
          }}
        />
      </Card>
    </section>
  );
}
