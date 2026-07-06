import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  TbArrowLeft,
  TbChartBar,
  TbExternalLink,
  TbMap2,
  TbRadar2,
  TbSwords,
  TbUserQuestion,
} from "react-icons/tb";
import type { StatsRange } from "@4eselo/types";
import { getPlayer } from "../lib/api";
import { Avatar, Button, Card, RangeTabs, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { StatsBento } from "../components/StatsBento";
import { RadarPerf } from "../components/RadarPerf";
import { MapStats } from "../components/MapStats";
import { MatchesList } from "../components/MatchesList";
import { RecentPerformance } from "../components/RecentPerformance";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { EloSummaryCard } from "../components/EloSummaryCard";
import { ShareButton } from "../components/ShareButton";
import { useTitle } from "../lib/useTitle";

function PlayerSkeleton() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,920px)_1fr] lg:items-start">
      <div className="flex flex-col gap-4 lg:w-[300px] lg:justify-self-end">
        <Card className="flex flex-col items-center gap-4 p-6">
          <Skeleton className="size-26 rounded-full" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-24" />
        </Card>
        <Card className="p-4">
          <Skeleton className="h-28 w-full" />
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        <Card className="flex items-center gap-6 p-6">
          <Skeleton className="size-33 rounded-full" />
          <Skeleton className="h-14 flex-1" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-56 w-full rounded-xl" />
        </Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-7 w-20" />
            </Card>
          ))}
        </div>
      </div>
      <div className="hidden lg:block" />
    </div>
  );
}

/** Titre de section : petite icône brand + libellé capitales espacées. */
function SectionTitle({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
      <Icon size={14} className="text-brand" />
      {children}
    </div>
  );
}

export function Player() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [range, setRange] = useState<StatsRange>("all");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["player", id],
    queryFn: () => getPlayer(id),
    enabled: id.length > 0,
  });

  const name = data?.faceitNickname ?? data?.discordName ?? "Joueur";
  useTitle(name);

  return (
    <div>
      <Link
        to="/classement"
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
      >
        <TbArrowLeft size={16} /> Classement
      </Link>

      {isLoading && <PlayerSkeleton />}
      {isError && (
        <EmptyState
          icon={TbUserQuestion}
          title="Joueur introuvable"
          action={<Button onClick={() => navigate("/classement")}>Retour au classement</Button>}
        >
          Ce joueur n'existe pas ou n'est plus suivi.
        </EmptyState>
      )}

      {data && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,920px)_1fr] lg:items-start">
          {/* Rail annexe : identité + activité (dans le gutter gauche, collé au centre) */}
          <aside className="flex flex-col gap-4 lg:w-[300px] lg:justify-self-end">
            <Card className="flex flex-col items-center gap-4 p-6 text-center">
              <Avatar name={name} size={104} />
              <div className="min-w-0">
                <h1 className="truncate text-[22px] font-extrabold tracking-[-0.03em]">{name}</h1>
                <div className="mt-2 flex flex-wrap justify-center gap-4 text-[13px] text-ink-dim">
                  {data.faceitNickname && (
                    <a
                      href={`https://www.faceit.com/fr/players/${data.faceitNickname}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 transition-colors hover:text-brand-hi"
                    >
                      Faceit <TbExternalLink size={13} />
                    </a>
                  )}
                  {data.steamId64 && (
                    <a
                      href={`https://steamcommunity.com/profiles/${data.steamId64}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 transition-colors hover:text-brand-hi"
                    >
                      Steam <TbExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
              <ShareButton className="w-full" />
            </Card>

            <ActivityHeatmap id={id} />
          </aside>

          {/* Colonne principale — centrée sur la page */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* ELO — carte principale façon « Season » */}
            <EloSummaryCard id={id} elo={data.elo} level={data.level} />

            {/* Performances récentes — courbe + forme + récap */}
            <RecentPerformance id={id} history={data.history} elo={data.elo} />

            {/* Statistiques agrégées (depuis les matchs), filtrables par période */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <SectionTitle icon={TbChartBar}>Statistiques</SectionTitle>
                <RangeTabs value={range} onChange={setRange} />
              </div>
              <StatsBento id={id} range={range} />
            </div>

            {/* Radar de performance */}
            <div>
              <div className="mb-3">
                <SectionTitle icon={TbRadar2}>Profil de performance</SectionTitle>
              </div>
              <RadarPerf id={id} range={range} />
            </div>

            {/* Stats par map */}
            <div>
              <div className="mb-3">
                <SectionTitle icon={TbMap2}>Par map</SectionTitle>
              </div>
              <MapStats id={id} range={range} />
            </div>

            {/* Matchs récents */}
            <div>
              <div className="mb-3">
                <SectionTitle icon={TbSwords}>Matchs récents</SectionTitle>
              </div>
              <MatchesList id={id} />
            </div>
          </div>

          {/* Gutter droit : vide, pour que la colonne principale soit centrée */}
          <div className="hidden lg:block" />
        </div>
      )}
    </div>
  );
}
