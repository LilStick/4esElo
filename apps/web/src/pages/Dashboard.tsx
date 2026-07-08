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

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
        {/* Rail annexe : joueur du jour, grimpeur, présence, mouvements — en entier, sans clic */}
        <aside className="flex flex-col gap-4 xl:w-[300px]">
          <PlayerOfTheDay />
          <TopClimber />
          <LivePresence />
          <RecentMovements />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <HomeHero />

          <ActivityHeatmap title="Activité du pôle" />

          <PoleRecords />

          <LadderPreview />

          <HomeAccountBanner />
        </div>
      </div>
    </div>
  );
}
