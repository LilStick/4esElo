import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { HomeHero } from "../components/HomeHero";
import { PlayerOfTheDay } from "../components/PlayerOfTheDay";
import { RecentMovements } from "../components/RecentMovements";
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

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        {/* Rail annexe : qui est en jeu + qui a bougé, en entier, sans clic (comme sur le profil) */}
        <aside className="flex flex-col gap-4">
          <LivePresence />
          <RecentMovements />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <HomeHero />

          <div className="grid gap-4 sm:grid-cols-2">
            <PlayerOfTheDay />
            <TopClimber />
          </div>

          <ActivityHeatmap title="Activité du pôle" />

          <PoleRecords />

          <LadderPreview />

          <HomeAccountBanner />
        </div>
      </div>
    </div>
  );
}
