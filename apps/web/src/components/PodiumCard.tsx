import { Link } from "react-router-dom";
import { TbCrown } from "react-icons/tb";
import type { LeaderboardEntry } from "@4eselo/types";
import { Avatar, Card, LevelBadge } from "../ui";
import { cn } from "../lib/cn";

const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "—";

/** Carte de podium (top 3) — la 1re place surélevée + couronne. Partagée home / classement. */
export function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const first = entry.rank === 1;
  return (
    <Link
      to={`/player/${entry.id}`}
      className="group block rounded-[var(--r-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      <Card
        outerClassName={cn(
          "transition-[border-color] duration-200 group-hover:border-white/20",
          first &&
            "-translate-y-4 shadow-[0_0_40px_-14px_rgba(94,139,255,0.45),0_24px_60px_-30px_rgba(0,0,0,0.9)]",
        )}
        className="relative p-4 text-center sm:p-5"
      >
        {first && (
          <TbCrown
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-brand drop-shadow-[0_0_8px_rgba(94,139,255,0.5)]"
            size={22}
          />
        )}
        <span className="absolute top-1.5 left-2 font-mono text-xs font-bold text-ink-faint">
          #{entry.rank}
        </span>
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
