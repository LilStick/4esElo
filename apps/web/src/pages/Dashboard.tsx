import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { TbArrowRight } from "react-icons/tb";
import type { LeaderboardEntry } from "@4eselo/types";
import { getLeaderboard } from "../lib/api";
import { Avatar, Card, HoverBarList, LevelBadge, Skeleton } from "../ui";
import { PlayerOfTheDay } from "../components/PlayerOfTheDay";
import { RecentMovements } from "../components/RecentMovements";
import { LivePresence } from "../components/LivePresence";
import { useTitle } from "../lib/useTitle";

const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "—";

export function Dashboard() {
  useTitle("Tableau de bord");
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", "faceit"],
    queryFn: () => getLeaderboard("faceit"),
  });
  const top = (data?.leaderboard ?? []).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-sm text-ink-dim">Le pouls du pôle CS2, en un coup d'œil.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <PlayerOfTheDay />
        <RecentMovements />
        <LivePresence />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
            Top classement
          </div>
          <Link
            to="/classement"
            className="inline-flex items-center gap-1 text-sm text-ink-dim transition-colors hover:text-brand-hi"
          >
            Voir tout <TbArrowRight size={15} />
          </Link>
        </div>

        {isLoading ? (
          <Card className="flex flex-col gap-1 p-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2.5">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="size-[34px] rounded-full" />
                <Skeleton className="h-4 flex-1 max-w-[160px]" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </Card>
        ) : top.length > 0 ? (
          <Card className="p-2">
            <HoverBarList
              items={top}
              rowHeight={52}
              keyOf={(e) => e.id}
              onSelect={(e) => navigate(`/player/${e.id}`)}
              children={(e) => (
                <>
                  <span className="w-5 text-center font-mono font-bold text-ink-faint">{e.rank}</span>
                  <Avatar name={nameOf(e)} size={32} />
                  <LevelBadge level={e.level} size={22} />
                  <span className="flex-1 truncate font-semibold">{nameOf(e)}</span>
                  <span className="font-mono text-sm font-bold text-brand tabular-nums">{e.elo ?? "—"}</span>
                </>
              )}
            />
          </Card>
        ) : (
          <Card className="p-6 text-center text-sm text-ink-dim">Aucun joueur pour l'instant.</Card>
        )}
      </div>
    </div>
  );
}
