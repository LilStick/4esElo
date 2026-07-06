import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { TbArrowRight } from "react-icons/tb";
import type { LeaderboardEntry } from "@4eselo/types";
import { getLeaderboard } from "../lib/api";
import { Avatar, Card, HoverBarList, LevelBadge, Skeleton } from "../ui";
import { HomeHero } from "../components/HomeHero";
import { PodiumCard } from "../components/PodiumCard";
import { PlayerOfTheDay } from "../components/PlayerOfTheDay";
import { RecentMovements } from "../components/RecentMovements";
import { LivePresence } from "../components/LivePresence";
import { TopClimber } from "../components/TopClimber";
import { JoinCta } from "../components/JoinCta";
import { useTitle } from "../lib/useTitle";

const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "—";

export function Dashboard() {
  useTitle("Accueil");
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", "faceit"],
    queryFn: () => getLeaderboard("faceit"),
  });
  const board = data?.leaderboard ?? [];
  const [first, second, third] = board;
  const rest = board.slice(3, 8);

  return (
    <div className="flex flex-col gap-6">
      <HomeHero />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* Colonne principale : podium + aperçu classement */}
        <div className="flex flex-col gap-6">
          {isLoading ? (
            <div className="grid grid-cols-3 items-end gap-3 sm:gap-4">
              {[0, 1, 2].map((i) => (
                <Card key={i} outerClassName={i === 1 ? "-translate-y-4" : undefined} className="p-5">
                  <Skeleton className="mx-auto size-[60px] rounded-full" />
                  <Skeleton className="mx-auto mt-3 h-4 w-20" />
                  <Skeleton className="mx-auto mt-3 h-5 w-14" />
                </Card>
              ))}
            </div>
          ) : first && second && third ? (
            <div className="mt-4 grid grid-cols-3 items-end gap-3 sm:gap-4">
              <PodiumCard entry={second} />
              <PodiumCard entry={first} />
              <PodiumCard entry={third} />
            </div>
          ) : null}

          {rest.length > 0 && (
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
              <Card className="p-2">
                <HoverBarList
                  items={rest}
                  rowHeight={52}
                  keyOf={(e) => e.id}
                  onSelect={(e) => navigate(`/player/${e.id}`)}
                  children={(e) => (
                    <>
                      <span className="w-5 text-center font-mono font-bold text-ink-faint">{e.rank}</span>
                      <Avatar name={nameOf(e)} size={32} />
                      <LevelBadge level={e.level} size={22} />
                      <span className="flex-1 truncate font-semibold">{nameOf(e)}</span>
                      <span className="font-mono text-sm font-bold text-brand tabular-nums">
                        {e.elo ?? "—"}
                      </span>
                    </>
                  )}
                />
              </Card>
            </div>
          )}

          {data && board.length === 0 && (
            <Card className="p-6 text-center text-sm text-ink-dim">Aucun joueur pour l'instant.</Card>
          )}
        </div>

        {/* Rail de blocs */}
        <div className="flex flex-col gap-4">
          <PlayerOfTheDay />
          <TopClimber />
          <LivePresence />
          <RecentMovements />
          <JoinCta />
        </div>
      </div>
    </div>
  );
}
