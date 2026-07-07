import { HomeHero } from "../components/HomeHero";
import { PlayerOfTheDay } from "../components/PlayerOfTheDay";
import { RecentMovements } from "../components/RecentMovements";
import { LivePresence } from "../components/LivePresence";
import { TopClimber } from "../components/TopClimber";
import { PoleRecords } from "../components/PoleRecords";
import { LadderPreview } from "../components/LadderPreview";
import { HomeAccountBanner } from "../components/HomeAccountBanner";
import { useTitle } from "../lib/useTitle";

export function Dashboard() {
  useTitle("Accueil");

  return (
    <div className="flex flex-col gap-6">
      <HomeHero />

      <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-4">
        <PlayerOfTheDay />
        <TopClimber />
        <LivePresence />
        <RecentMovements />
      </div>

      <PoleRecords />

      <LadderPreview />

      <HomeAccountBanner />
    </div>
  );
}
