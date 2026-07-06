import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TbFlame } from "react-icons/tb";
import type { MoverEntry } from "@4eselo/types";
import { getMovers } from "../lib/api";
import { Avatar, Card, LevelBadge, Skeleton } from "../ui";

const nameOf = (m: MoverEntry) => m.faceitNickname ?? m.discordName ?? "—";

/** Widget « Joueur du jour » : plus gros gain d'ELO sur 24h (+ mention de la plus grosse chute). */
export function PlayerOfTheDay() {
  const { data, isLoading } = useQuery({
    queryKey: ["movers", "24h"],
    queryFn: () => getMovers("24h"),
  });

  const movers = data?.movers ?? [];
  const gainers = movers.filter((m) => m.delta != null && m.delta > 0);
  const losers = movers.filter((m) => m.delta != null && m.delta < 0);
  const best = gainers[0];
  const worst = losers.at(-1);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        <TbFlame size={14} className="text-brand" />
        Joueur du jour
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        </div>
      ) : best ? (
        <>
          <Link to={`/player/${best.id}`} className="group flex items-center gap-3">
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

          {worst && (
            <div className="border-t border-white/[0.06] pt-2 text-xs text-ink-dim">
              Plus grosse chute :{" "}
              <Link
                to={`/player/${worst.id}`}
                className="font-semibold text-ink transition-colors hover:text-brand-hi"
              >
                {nameOf(worst)}
              </Link>{" "}
              <span className="font-mono font-bold text-loss tabular-nums">{worst.delta}</span>
            </div>
          )}
        </>
      ) : (
        <div className="py-2 text-sm text-ink-dim">Personne n'a bougé son ELO aujourd'hui.</div>
      )}
    </Card>
  );
}
