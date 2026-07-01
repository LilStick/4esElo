import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { getLeaderboard } from "../lib/api";
import { LevelBadge } from "../components/LevelBadge";
import { cn } from "../lib/cn";

const rankColor = (rank: number) =>
  rank === 1
    ? "text-yellow-400"
    : rank === 2
      ? "text-zinc-300"
      : rank === 3
        ? "text-amber-600"
        : "text-zinc-600";

export function Leaderboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard", "faceit"],
    queryFn: () => getLeaderboard("faceit"),
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Classement</h1>
      <p className="mb-6 text-sm text-zinc-500">Membres du pôle CS2, triés par ELO Faceit.</p>

      {isLoading && <p className="text-zinc-500">Chargement…</p>}
      {isError && <p className="text-red-400">Impossible de charger le classement. L'API tourne-t-elle ?</p>}

      <ul className="space-y-2">
        {data?.leaderboard.map((entry, i) => (
          <motion.li
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Link
              to={`/player/${entry.id}`}
              className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            >
              <span className={cn("w-6 text-center text-lg font-bold tabular-nums", rankColor(entry.rank))}>
                {entry.rank}
              </span>
              <LevelBadge level={entry.level} />
              <span className="flex-1 truncate font-medium">
                {entry.faceitNickname ?? entry.discordName ?? "—"}
              </span>
              <span className="font-mono text-sm font-semibold text-orange-400 tabular-nums">
                {entry.elo ?? "—"}
              </span>
              <ChevronRight className="size-4 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.li>
        ))}
      </ul>

      {data && data.leaderboard.length === 0 && <p className="text-zinc-500">Aucun joueur pour l'instant.</p>}
    </div>
  );
}
