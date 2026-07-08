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

      <div className="grid gap-4 2xl:grid-cols-[280px_minmax(0,1fr)] 2xl:items-start">
        {/* Rail annexe : joueur du jour, grimpeur, présence, mouvements, records — en entier, sans clic */}
        <aside className="flex flex-col gap-4 2xl:w-[280px]">
          <PlayerOfTheDay />
          <TopClimber />
          <LivePresence />
          <RecentMovements />
          <PoleRecords />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <HomeHero />

          <ActivityHeatmap title="Activité du pôle" />

          <LadderPreview />

          <HomeAccountBanner />
        </div>
      </div>
    </div>
  );
}
