import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { TbArrowRight, TbCrown } from "react-icons/tb";
import type { LeaderboardEntry } from "@4eselo/types";
import { getLeaderboard } from "../lib/api";
import { Avatar, Card, HoverBarList, LevelBadge } from "../ui";
import { cn } from "../lib/cn";

const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "—";

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const first = entry.rank === 1;
  return (
    <Link
      to={`/player/${entry.id}`}
      className="group block rounded-[var(--r-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      <Card
        outerClassName={cn(
          "transition-[border-color] duration-200 group-hover:border-white/20",
          first && "-translate-y-4 shadow-[0_0_40px_-14px_rgba(94,139,255,0.45),0_24px_60px_-30px_rgba(0,0,0,0.9)]",
        )}
        className="relative p-5 text-center"
      >
        {first && (
          <TbCrown
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-brand drop-shadow-[0_0_8px_rgba(94,139,255,0.5)]"
            size={22}
          />
        )}
        <span className="absolute top-1.5 left-2 font-mono text-xs font-bold text-ink-faint">#{entry.rank}</span>
        <div className="mx-auto mt-1.5 mb-3 w-fit">
          <Avatar name={nameOf(entry)} size={60} />
        </div>
        <div className="truncate text-[15px] font-bold">{nameOf(entry)}</div>
        <div className="mt-2 flex justify-center">
          <LevelBadge level={entry.level} size={26} />
        </div>
        <div className="mt-2 font-mono text-[23px] font-extrabold text-brand tabular-nums transition-colors group-hover:text-brand-hi">
          {entry.elo ?? "—"}
        </div>
      </Card>
    </Link>
  );
}

export function Leaderboard() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard", "faceit"],
    queryFn: () => getLeaderboard("faceit"),
  });

  const board = data?.leaderboard ?? [];
  const [first, second, third] = board;
  const hasPodium = Boolean(first && second && third);
  const listItems = hasPodium ? board.slice(3) : board;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Classement</h1>
      <p className="mt-1 mb-8 text-sm text-ink-dim">Membres du pôle CS2, triés par ELO Faceit.</p>

      {isLoading && <p className="text-ink-dim">Chargement…</p>}
      {isError && <p className="text-loss">Impossible de charger le classement. L'API tourne-t-elle ?</p>}

      {hasPodium && first && second && third && (
        <div className="mb-4 grid grid-cols-3 items-end gap-3 sm:gap-4">
          <PodiumCard entry={second} />
          <PodiumCard entry={first} />
          <PodiumCard entry={third} />
        </div>
      )}

      {listItems.length > 0 && (
        <Card className="p-[var(--bezel)]">
          <HoverBarList
            items={listItems}
            rowHeight={56}
            keyOf={(e) => e.id}
            onSelect={(e) => navigate(`/player/${e.id}`)}
            children={(e) => (
              <>
                <span className="w-5 text-center font-mono font-bold text-ink-faint">{e.rank}</span>
                <Avatar name={nameOf(e)} size={34} />
                <LevelBadge level={e.level} size={24} />
                <span className="flex-1 truncate font-semibold">{nameOf(e)}</span>
                <span className="font-mono text-[15px] font-bold text-brand tabular-nums">{e.elo ?? "—"}</span>
                <TbArrowRight className="text-ink-faint" size={17} />
              </>
            )}
          />
        </Card>
      )}

      {data && board.length === 0 && <p className="text-ink-dim">Aucun joueur pour l'instant.</p>}
    </div>
  );
}
