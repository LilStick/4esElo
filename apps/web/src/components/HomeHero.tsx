import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "../lib/api";
import { Card } from "../ui";
import lockup from "../assets/logo/4esElo_lockup_transparent.png";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="font-mono text-xl font-extrabold text-brand tabular-nums sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-[10px] tracking-[0.14em] text-ink-faint uppercase">{label}</div>
    </div>
  );
}

/** Hero du home : identité 4esElo + barre de stats du pôle (depuis le classement). */
export function HomeHero() {
  const { data } = useQuery({ queryKey: ["leaderboard", "faceit"], queryFn: () => getLeaderboard("faceit") });
  const board = data?.leaderboard ?? [];
  const elos = board.map((b) => b.elo).filter((e): e is number => e != null);
  const levels = board.map((b) => b.level).filter((l): l is number => l != null);
  const eloAvg = elos.length ? Math.round(elos.reduce((a, b) => a + b, 0) / elos.length) : "—";
  const topElo = elos.length ? Math.max(...elos) : "—";
  const lvlAvg = levels.length ? (levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1) : "—";

  return (
    <Card className="relative overflow-hidden p-8 text-center sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[720px] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl"
      />
      <div className="relative flex flex-col items-center gap-4">
        <img src={lockup} alt="4esElo" className="h-14 w-auto invert" />
        <p className="max-w-xl text-sm text-ink-dim">
          Le classement Faceit du pôle CS2 de <b className="text-ink">4eSport</b> · Efrei Paris — en direct.
        </p>
        <div className="mt-2 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Membres" value={board.length} />
          <Stat label="ELO moyen" value={eloAvg} />
          <Stat label="Top ELO" value={topElo} />
          <Stat label="Niveau moyen" value={lvlAvg} />
        </div>
      </div>
    </Card>
  );
}
