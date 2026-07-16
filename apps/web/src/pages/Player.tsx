import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  TbArrowLeft,
  TbChartBar,
  TbExternalLink,
  TbFlame,
  TbLock,
  TbMap2,
  TbRadar2,
  TbSwords,
  TbTrophy,
  TbUserQuestion,
} from "react-icons/tb";
import type { StatsRange } from "@4eselo/types";
import { getPlayer } from "../lib/api";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Button, Card, RangeTabs, Skeleton } from "../ui";
import { Badges } from "../components/Badges";
import { EmptyState } from "../components/EmptyState";
import { StatsBento } from "../components/StatsBento";
import { RadarPerf } from "../components/RadarPerf";
import { PlayerBenchmark } from "../components/PlayerBenchmark";
import { MapStats } from "../components/MapStats";
import { MatchesList } from "../components/MatchesList";
import { RecentPerformance } from "../components/RecentPerformance";
import { AchievementsSummary } from "../components/AchievementsSummary";
import { ProfileRoast } from "../components/ProfileRoast";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { PlayerDuos } from "../components/PlayerDuos";
import { EloSummaryCard } from "../components/EloSummaryCard";
import { ShareButton } from "../components/ShareButton";
import { isAlumni, promoLabel } from "../lib/promo";
import { useTitle } from "../lib/useTitle";

function PlayerSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,920px)_1fr] xl:items-start">
      <div className="flex flex-col gap-4 xl:w-[300px] xl:justify-self-end">
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
      <div className="hidden xl:block" />
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_minmax(0,920px)_1fr] xl:items-start">
          {/* Colonne gauche (desktop). En 1 colonne, `contents` aplatit ses items dans la grille
              et chacun est ordonné via `order-*` pour donner la séquence demandée. */}
          <div className="contents xl:flex xl:w-[300px] xl:flex-col xl:gap-4 xl:justify-self-end">
            {/* 1 - profil + retour */}
            <div className="order-1 flex flex-col gap-4">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex cursor-pointer items-center gap-1.5 self-start text-sm text-ink-dim transition-colors hover:text-ink"
              >
                <TbArrowLeft size={16} /> Retour
              </button>
              <Card className="flex flex-col items-center gap-4 p-6 text-center">
                <Avatar name={name} size={104} src={discordAvatarUrl(data.discordId, data.discordAvatar)} />
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

                <Badges tiers={data.badgeTiers} className="flex-wrap justify-center" />

                {(isAlumni(data.promoEnd) ||
                  promoLabel(data.promoStart, data.promoEnd) ||
                  data.formation) && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {isAlumni(data.promoEnd) && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand-hi">
                        🎓 Alumni
                      </span>
                    )}
                    {promoLabel(data.promoStart, data.promoEnd) && (
                      <span className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-ink-dim">
                        Promo {promoLabel(data.promoStart, data.promoEnd)}
                      </span>
                    )}
                    {data.formation && (
                      <span className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-[11px] text-ink-dim">
                        {data.formation}
                      </span>
                    )}
                  </div>
                )}

                <ShareButton className="w-full" />

                {data.playtimePrivate === true && (
                  <div className="flex items-start gap-2 rounded-lg border border-loss/25 bg-loss/[0.08] px-3 py-2 text-left text-xs text-ink-dim">
                    <TbLock size={14} className="mt-0.5 shrink-0 text-loss" />
                    <span>
                      Heures de jeu privées - passe «&nbsp;Détails du jeu&nbsp;» en public sur{" "}
                      <a
                        href="https://steamcommunity.com/my/edit/settings"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-loss underline-offset-2 hover:underline"
                      >
                        Steam
                      </a>{" "}
                      pour apparaître dans les stats de temps de jeu.
                    </span>
                  </div>
                )}
              </Card>
            </div>

            {/* 6 - heatmap d'activité */}
            <div className="order-6">
              <ActivityHeatmap id={id} />
            </div>

            {/* 11 - avec qui il win le + */}
            <div className="order-11">
              <PlayerDuos id={id} />
            </div>

            {/* 12 - roast 4esBot (déterministe, négatif + positif) */}
            <div className="order-12">
              <div className="mb-3">
                <SectionTitle icon={TbFlame}>Roast</SectionTitle>
              </div>
              <ProfileRoast id={id} />
            </div>
          </div>

          {/* Colonne centrale (desktop). En 1 colonne, `contents` + `order-*` intercalent ses
              items avec ceux de la colonne gauche selon la séquence demandée. */}
          <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4">
            {/* 2 - ELO */}
            <div className="order-2">
              <EloSummaryCard id={id} elo={data.elo} level={data.level} />
            </div>

            {/* 3 - performances récentes */}
            <div className="order-3">
              <RecentPerformance id={id} history={data.history} elo={data.elo} streak={data.streak} />
            </div>

            {/* 4 - statistiques */}
            <div className="order-4 min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <SectionTitle icon={TbChartBar}>Statistiques</SectionTitle>
                <RangeTabs value={range} onChange={setRange} />
              </div>
              <StatsBento id={id} range={range} />
            </div>

            {/* 5 - profil de performance */}
            <div className="order-5">
              <div className="mb-3">
                <SectionTitle icon={TbRadar2}>Profil de performance</SectionTitle>
              </div>
              <RadarPerf id={id} range={range} />
            </div>

            {/* 7 - par map */}
            <div className="order-7">
              <div className="mb-3">
                <SectionTitle icon={TbMap2}>Par map</SectionTitle>
              </div>
              <MapStats id={id} range={range} />
            </div>

            {/* 8 - matchs récents */}
            <div className="order-8 min-w-0">
              <div className="mb-3">
                <SectionTitle icon={TbSwords}>Matchs récents</SectionTitle>
              </div>
              <MatchesList id={id} />
            </div>

            {/* 9 - ta place dans l'asso (benchmark intra-asso, même fenêtre que les stats) */}
            <div className="order-9">
              <div className="mb-3">
                <SectionTitle icon={TbTrophy}>Ta place dans l'asso</SectionTitle>
              </div>
              <PlayerBenchmark id={id} range={range} />
            </div>

            {/* 10 - succès (résumé cliquable → page dédiée) */}
            <div className="order-10">
              <AchievementsSummary id={id} />
            </div>
          </div>

          {/* Gutter droit : vide, pour que la colonne principale reste centrée */}
          <div className="hidden xl:block" />
        </div>
      )}
    </div>
  );
}
