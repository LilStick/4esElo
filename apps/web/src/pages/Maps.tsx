import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { TbArrowLeft, TbMap2 } from "react-icons/tb";
import type { MapLeaderboardEntry } from "@4eselo/types";
import { getMapsLeaderboard } from "../lib/api";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Card, HoverBarList, MapIcon, Skeleton } from "../ui";
import { cn } from "../lib/cn";
import { EmptyState } from "../components/EmptyState";
import { useTitle } from "../lib/useTitle";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());
const MEDALS = ["🥇", "🥈", "🥉"];

/** Pool Active Duty Faceit CS2 (mis à jour : juillet 2025). */
const ACTIVE_POOL = new Set([
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_train",
]);

function Row({ e, index }: { e: MapLeaderboardEntry; index: number }) {
  return (
    <>
      <span className="w-6 shrink-0 text-center font-mono text-sm font-bold text-ink-faint">
        {MEDALS[index] ?? index + 1}
      </span>
      <Avatar
        name={e.player.nickname}
        size={34}
        src={discordAvatarUrl(e.player.discordId, e.player.discordAvatar)}
      />
      <span className="min-w-0 flex-1 truncate font-semibold">{e.player.nickname}</span>
      <span className="flex shrink-0 items-center gap-6 font-mono text-sm tabular-nums sm:gap-9">
        <span className="w-12 text-right font-extrabold text-win">{Math.round(e.winRate)}%</span>
        <span className={cn("w-10 text-right", e.kd >= 1 ? "text-win" : "")}>{e.kd.toFixed(2)}</span>
        <span className="hidden w-16 text-right text-ink-faint sm:block">{e.matches} games</span>
      </span>
    </>
  );
}

/** Classement par map (B13.5) — sélecteur de map + top membres dessus (winrate, K/D). */
export function Maps() {
  useTitle("Classement par map");
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["leaderboard", "maps"], queryFn: getMapsLeaderboard });
  const [selected, setSelected] = useState<string | null>(null);

  const maps = (data?.maps ?? []).filter((m) => ACTIVE_POOL.has(m.map));
  const current = maps.find((m) => m.map === selected) ?? maps[0];

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
      >
        <TbArrowLeft size={16} /> Retour
      </button>

      <div className="mt-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TbMap2 className="text-brand" size={24} />
          Classement par map
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Les rois de chaque carte
          {data ? ` — à partir de ${data.minMatches} games sur la map.` : "."}
        </p>
      </div>

      {isLoading ? (
        <Card outerClassName="mt-6" className="flex flex-col gap-2 p-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 max-w-[180px] flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </Card>
      ) : maps.length === 0 || !current ? (
        <Card outerClassName="mt-6" className="py-2">
          <EmptyState icon={TbMap2} title="Pas encore de classement par map">
            Il faut quelques matchs synchronisés sur une même carte pour établir un classement.
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* Sélecteur de map (trié par activité) */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {maps.map((m) => {
              const active = m.map === current.map;
              return (
                <button
                  key={m.map}
                  onClick={() => setSelected(m.map)}
                  className={cn(
                    "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none",
                    active
                      ? "border-brand/40 bg-brand/10 text-brand-hi"
                      : "border-white/[0.08] bg-white/[0.02] text-ink-dim hover:text-ink",
                  )}
                >
                  <MapIcon map={m.map} size={20} />
                  {prettyMap(m.map)}
                </button>
              );
            })}
          </div>

          {/* En-tête colonnes + classement de la map sélectionnée */}
          <Card outerClassName="mt-4" className="p-2">
            <div className="mb-1 flex items-center gap-4 px-4 text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
              <span className="w-6 text-center">#</span>
              <span className="min-w-0 flex-1">Membre</span>
              <span className="flex shrink-0 items-center gap-6 sm:gap-9">
                <span className="w-12 text-right">Winrate</span>
                <span className="w-10 text-right">K/D</span>
                <span className="hidden w-16 text-right sm:block">Games</span>
              </span>
            </div>
            <HoverBarList
              items={current.players}
              rowHeight={58}
              keyOf={(e) => e.player.id}
              onSelect={(e) => navigate(`/player/${e.player.id}`)}
              children={(e, i) => <Row e={e} index={i} />}
            />
          </Card>
        </>
      )}
    </div>
  );
}
