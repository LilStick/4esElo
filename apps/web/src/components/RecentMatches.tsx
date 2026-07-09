import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TbSwords } from "react-icons/tb";
import type { RecentMatchEntry } from "@4eselo/types";
import { getRecentMatches, getPlayerMatches } from "../lib/api";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Card, HoverBarList, MapIcon, Skeleton } from "../ui";
import { cn } from "../lib/cn";
import { relativeTime, fullDate } from "../lib/relativeTime";
import { EmptyState } from "./EmptyState";
import { MatchDetailModal } from "./MatchDetailModal";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());

function Header() {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
      <TbSwords size={14} className="shrink-0 text-brand" />
      Matchs récents
    </div>
  );
}

/** Ouvre la modale de détail pour une entrée du feed : le feed ne porte pas les stats,
 *  on va donc chercher le match complet dans les matchs du joueur (par matchId). */
function RecentMatchModal({ entry, onClose }: { entry: RecentMatchEntry | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["match-lookup", entry?.player.id],
    queryFn: () => getPlayerMatches(entry!.player.id, 50),
    enabled: !!entry,
  });
  const match = entry ? (data?.items.find((m) => m.matchId === entry.matchId) ?? null) : null;
  return <MatchDetailModal match={match} open={!!entry} loading={isLoading} onClose={onClose} />;
}

/** Widget « Matchs récents » (rail droit de la home) : flux de tous les matchs du pôle,
 *  une ligne par membre par match, ±ELO coloré, clic → détail du match. */
export function RecentMatches() {
  const [selected, setSelected] = useState<RecentMatchEntry | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["recent-matches"], queryFn: () => getRecentMatches(20) });

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <Header />
        <Card className="flex flex-col gap-1 p-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-1.5 h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </Card>
      </section>
    );
  }

  const items = data?.items ?? [];

  return (
    <section className="flex flex-col gap-3">
      <Header />
      {items.length === 0 ? (
        <Card className="py-2">
          <EmptyState icon={TbSwords} title="Aucun match récent">
            Les matchs du pôle apparaîtront ici après une synchronisation.
          </EmptyState>
        </Card>
      ) : (
        <Card className="p-2">
          <HoverBarList
            items={items}
            rowHeight={64}
            keyOf={(m) => `${m.matchId}:${m.player.id}`}
            onSelect={(m) => setSelected(m)}
            children={(m) => {
              const win = m.result === 1;
              return (
                <>
                  <Avatar
                    name={m.player.nickname}
                    size={34}
                    src={discordAvatarUrl(m.player.discordId, m.player.discordAvatar)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{m.player.nickname}</div>
                    <div
                      className="flex items-center gap-1.5 text-xs text-ink-faint"
                      title={fullDate(m.playedAt)}
                    >
                      <MapIcon map={m.map} size={14} />
                      <span className="truncate">{prettyMap(m.map)}</span>
                      <span>·</span>
                      <span className="shrink-0">{relativeTime(m.playedAt)}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-extrabold",
                      win ? "bg-win/12 text-win" : "bg-loss/12 text-loss",
                    )}
                    title={win ? "Victoire" : "Défaite"}
                  >
                    {win ? "V" : "D"}
                  </span>
                  <span
                    className={cn(
                      "w-11 shrink-0 text-right font-mono text-sm font-extrabold tabular-nums",
                      m.eloDelta == null ? "text-ink-faint" : m.eloDelta > 0 ? "text-win" : "text-loss",
                    )}
                    title="±ELO du match"
                  >
                    {m.eloDelta == null ? "—" : `${m.eloDelta > 0 ? "+" : ""}${m.eloDelta}`}
                  </span>
                </>
              );
            }}
          />
        </Card>
      )}
      <RecentMatchModal entry={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
