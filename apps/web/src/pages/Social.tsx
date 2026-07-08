import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TbHeartHandshake, TbUsersGroup } from "react-icons/tb";
import type { DuoStat } from "@4eselo/types";
import { getDuos } from "../lib/api";
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

export function Social() {
  useTitle("Social");
  const { data, isLoading, isError } = useQuery({ queryKey: ["duos"], queryFn: getDuos });
  const duos = data?.duos ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TbHeartHandshake className="text-brand" size={24} />
          Les duos du pôle
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Les paires qui gagnent le plus ensemble
          {data ? ` — à partir de ${data.minMatches} games en commun.` : "."}
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
    </div>
  );
}
