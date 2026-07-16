import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { HomeHero } from "../components/HomeHero";
import { PlayerOfTheDay } from "../components/PlayerOfTheDay";
import { RecentMatches } from "../components/RecentMatches";
import { Overtakes } from "../components/Overtakes";
import { LivePresence } from "../components/LivePresence";
import { TopClimber } from "../components/TopClimber";
import { PoleRecords } from "../components/PoleRecords";
import { LadderPreview } from "../components/LadderPreview";
import { HomeAccountBanner } from "../components/HomeAccountBanner";
import { AnnouncementBanner } from "../components/AnnouncementBanner";
import { useTitle } from "../lib/useTitle";

export function Dashboard() {
  useTitle("Accueil");

  return (
    <div className="flex flex-col gap-6">
      <AnnouncementBanner />

      {/* 2 colonnes dès xl (rail gauche + centre large), 3 colonnes à 2xl (ajoute le rail matchs)
          → le centre ne s'écrase pas sur les laptops ~1280-1536. */}
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start 2xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* Rail gauche : joueur du jour, grimpeur, présence, dépassements, records - en entier, sans clic.
            En 1 colonne il passe en dernier (ordre : centre → matchs → rail gauche). */}
        <aside className="order-3 flex flex-col gap-4 xl:order-1">
          <PlayerOfTheDay />
          <TopClimber />
          <LivePresence />
          <Overtakes />
          <PoleRecords />
        </aside>

        <div className="order-1 flex min-w-0 flex-col gap-6 xl:order-2">
          <HomeHero />

          <ActivityHeatmap title="Activité du pôle" />

          <LadderPreview />

          <HomeAccountBanner />
        </div>

        {/* Rail droit : flux de matchs récents. À xl (2 col) il passe pleine largeur sous le
            contenu ; à 2xl il devient la 3ᵉ colonne. */}
        <aside className="order-2 flex flex-col gap-4 xl:order-3 xl:col-span-2 2xl:col-span-1">
          <RecentMatches />
        </aside>
      </div>
    </div>
  );
}
