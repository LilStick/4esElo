import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Fragment } from "react";
import { TbHeartHandshake, TbUsersGroup } from "react-icons/tb";
import type { DuoStat, LineupStat } from "@4eselo/types";
import { getDuos, getLineups } from "../lib/api";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Card, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { useTitle } from "../lib/useTitle";

const MEDALS = ["🥇", "🥈", "🥉"];

function DuoRow({ duo, index }: { duo: DuoStat; index: number }) {
  const [a, b] = duo.players;
  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <span className="w-6 shrink-0 text-center font-mono text-sm font-bold text-ink-faint">
        {MEDALS[index] ?? index + 1}
      </span>
      {/* Avatars superposés */}
      <div className="flex shrink-0 -space-x-2">
        <span className="rounded-full ring-2 ring-bg">
          <Avatar name={a.nickname} size={34} src={discordAvatarUrl(a.discordId, a.discordAvatar)} />
        </span>
        <span className="rounded-full ring-2 ring-bg">
          <Avatar name={b.nickname} size={34} src={discordAvatarUrl(b.discordId, b.discordAvatar)} />
        </span>
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-semibold">
        <Link to={`/player/${a.id}`} className="transition-colors hover:text-brand-hi">
          {a.nickname}
        </Link>
        <span className="mx-1.5 text-ink-faint">&amp;</span>
        <Link to={`/player/${b.id}`} className="transition-colors hover:text-brand-hi">
          {b.nickname}
        </Link>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[15px] font-bold text-win tabular-nums">
          {Math.round(duo.winRate)}%
        </div>
        <div className="font-mono text-[11px] text-ink-faint tabular-nums">
          {duo.wins}V · {duo.matches} games
        </div>
      </div>
    </div>
  );
}

function LineupRow({ lineup, index }: { lineup: LineupStat; index: number }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <span className="w-6 shrink-0 text-center font-mono text-sm font-bold text-ink-faint">{index + 1}</span>
      <span className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-dim">
        {lineup.size}
      </span>
      {/* Avatars superposés du groupe */}
      <div className="flex shrink-0 -space-x-2">
        {lineup.players.map((p) => (
          <span key={p.id} className="rounded-full ring-2 ring-bg">
            <Avatar name={p.nickname} size={30} src={discordAvatarUrl(p.discordId, p.discordAvatar)} />
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-semibold">
        {lineup.players.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && <span className="mx-1 text-ink-faint">·</span>}
            <Link to={`/player/${p.id}`} className="transition-colors hover:text-brand-hi">
              {p.nickname}
            </Link>
          </Fragment>
        ))}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[15px] font-bold text-win tabular-nums">
          {Math.round(lineup.winRate)}%
        </div>
        <div className="font-mono text-[11px] text-ink-faint tabular-nums">
          {lineup.wins}V · {lineup.matches} games
        </div>
      </div>
    </div>
  );
}

export function Social() {
  useTitle("Social");
  const { data, isLoading, isError } = useQuery({ queryKey: ["duos"], queryFn: getDuos });
  const duos = data?.duos ?? [];
  const { data: lineupData } = useQuery({ queryKey: ["lineups"], queryFn: getLineups });
  // Tri par taille de groupe décroissante, puis winrate (les « fives » en tête).
  const lineups = [...(lineupData?.lineups ?? [])].sort((a, b) => b.size - a.size || b.winRate - a.winRate);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TbHeartHandshake className="text-brand" size={24} />
          Les duos du pôle
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Les paires qui gagnent le plus ensemble
          {data ? ` - à partir de ${data.minMatches} games en commun.` : "."}
        </p>
      </div>

      {isLoading && (
        <Card className="flex flex-col gap-2 p-[var(--bezel)]">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2.5">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="size-[34px] rounded-full" />
              <Skeleton className="h-4 max-w-[220px] flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </Card>
      )}

      {isError && <p className="text-loss">Impossible de charger les duos. L'API tourne-t-elle ?</p>}

      {data && duos.length === 0 && (
        <EmptyState icon={TbUsersGroup} title="Pas encore de duo">
          Personne n'a joué assez de games ensemble ({data.minMatches} minimum) pour l'instant.
        </EmptyState>
      )}

      {duos.length > 0 && (
        <Card className="flex flex-col divide-y divide-white/[0.05] p-[var(--bezel)]">
          {duos.map((duo, i) => (
            <DuoRow key={`${duo.players[0].id}-${duo.players[1].id}`} duo={duo} index={i} />
          ))}
        </Card>
      )}

      {/* Les fives du pôle (B4.5) - groupes de 3 à 5 qui jouent ensemble */}
      <div className="mt-2">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TbUsersGroup className="text-brand" size={24} />
          Les fives du pôle
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          Les groupes qui gagnent le plus ensemble
          {lineupData ? ` - à partir de ${lineupData.minMatches} games en commun.` : "."}
        </p>
      </div>

      {lineups.length > 0 ? (
        <Card className="flex flex-col divide-y divide-white/[0.05] p-[var(--bezel)]">
          {lineups.map((lineup, i) => (
            <LineupRow key={lineup.players.map((p) => p.id).join("-")} lineup={lineup} index={i} />
          ))}
        </Card>
      ) : (
        lineupData && (
          <EmptyState icon={TbUsersGroup} title="Pas encore de five">
            Aucun groupe n'a joué assez de games ensemble ({lineupData.minMatches} minimum) pour l'instant.
          </EmptyState>
        )
      )}
    </div>
  );
}
