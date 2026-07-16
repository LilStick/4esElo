import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TbCrown, TbFlame, TbPercentage, TbSwords } from "react-icons/tb";
import type { IconType } from "react-icons";
import type { LeaderboardEntry, PlayerStatsResponse } from "@4eselo/types";
import { getLeaderboard, getPlayerStats } from "../lib/api";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Card, CountUp, Skeleton } from "../ui";

const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "-";
const MIN_MATCHES = 5; // seuil pour les records de taux (winrate, K/D)

type Row = { p: LeaderboardEntry; s: PlayerStatsResponse["overall"] };

function bestBy(rows: Row[], pick: (r: Row) => number): Row | undefined {
  return rows.reduce<Row | undefined>((best, r) => (!best || pick(r) > pick(best) ? r : best), undefined);
}

function RecordCard({
  icon: Icon,
  label,
  player,
  value,
  format,
}: {
  icon: IconType;
  label: string;
  player: LeaderboardEntry | undefined;
  value: number | null;
  format?: (n: number) => string;
}) {
  if (!player) return null;
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-brand/10 text-brand">
        <Icon size={20} />
      </span>
      <Link to={`/player/${player.id}`} className="group flex min-w-0 flex-1 items-center gap-2">
        <Avatar
          name={nameOf(player)}
          size={30}
          src={discordAvatarUrl(player.discordId, player.discordAvatar)}
        />
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.14em] text-ink-faint uppercase">{label}</div>
          <div className="truncate text-sm font-semibold transition-colors group-hover:text-brand-hi">
            {nameOf(player)}
          </div>
        </div>
      </Link>
      <span className="font-mono text-lg font-extrabold text-brand tabular-nums">
        {value == null ? "-" : <CountUp value={value} format={format} />}
      </span>
    </Card>
  );
}

/** « Records du pôle » : top ELO, meilleur K/D, meilleur winrate, plus de matchs. */
export function PoleRecords() {
  const { data } = useQuery({ queryKey: ["leaderboard", "faceit"], queryFn: () => getLeaderboard("faceit") });
  const players = data?.leaderboard ?? [];

  const statsQueries = useQueries({
    queries: players.map((p) => ({
      queryKey: ["stats", p.id, "all"],
      queryFn: () => getPlayerStats(p.id, "all"),
    })),
  });

  const loading = players.length === 0 || statsQueries.some((q) => q.isLoading);
  const rows: Row[] = players
    .map((p, i) => ({ p, s: statsQueries[i]?.data?.overall }))
    .filter((r): r is Row => !!r.s);

  const eligible = rows.filter((r) => r.s.matches >= MIN_MATCHES);
  const topElo = players[0]; // classement trié par ELO
  const bestKd = bestBy(eligible, (r) => r.s.kd);
  const bestWr = bestBy(eligible, (r) => r.s.winRate);
  const mostMatches = bestBy(rows, (r) => r.s.matches);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        <TbCrown size={14} className="text-brand" />
        Records du pôle
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-1.5 h-4 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          <RecordCard icon={TbCrown} label="Plus haut ELO" player={topElo} value={topElo?.elo ?? null} />
          <RecordCard
            icon={TbSwords}
            label="Meilleur K/D"
            player={bestKd?.p}
            value={bestKd ? bestKd.s.kd : null}
            format={(n) => n.toFixed(2)}
          />
          <RecordCard
            icon={TbPercentage}
            label="Meilleur winrate"
            player={bestWr?.p}
            value={bestWr ? bestWr.s.winRate : null}
            format={(n) => `${Math.round(n)}%`}
          />
          <RecordCard
            icon={TbFlame}
            label="Plus de matchs"
            player={mostMatches?.p}
            value={mostMatches ? mostMatches.s.matches : null}
          />
        </div>
      )}
    </section>
  );
}
