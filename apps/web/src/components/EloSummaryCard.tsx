import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlayerMatches } from "../lib/api";
import { mapScreen } from "../lib/mapScreens";
import { Card, LevelBadge } from "../ui";

/** Couleur du palier façon Faceit : gris → vert → jaune → orange → rouge. */
function levelColor(level: number | null): string {
  if (!level) return "#9aa0ab";
  if (level === 1) return "#c7ccd6";
  if (level <= 3) return "#4ee27b";
  if (level <= 7) return "#ffcf3f";
  if (level <= 9) return "#ff9d3c";
  return "#ff4655";
}

/**
 * Carte ELO principale façon Faceit : glow ambiant teinté par le palier, logo
 * de niveau au centre, ELO en gros dessous, matchs + winrate en pied.
 */
export function EloSummaryCard({ id, elo, level }: { id: string; elo: number | null; level: number | null }) {
  const { data } = useQuery({
    queryKey: ["matches", id, 50],
    queryFn: () => getPlayerMatches(id, 50),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const wins = items.filter((m) => m.result === 1).length;
  const winrate = items.length ? Math.round((wins / items.length) * 100) : null;
  const color = levelColor(level);

  // Map la plus jouée → screenshot en fond discret.
  const topScreen = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of data?.items ?? []) c.set(m.map, (c.get(m.map) ?? 0) + 1);
    let best: string | undefined;
    let n = 0;
    for (const [map, cnt] of c) {
      if (cnt > n) {
        n = cnt;
        best = map;
      }
    }
    return best ? mapScreen(best) : undefined;
  }, [data]);

  return (
    <Card className="relative overflow-hidden p-6">
      {/* Fond : map la plus jouée, très estompée */}
      {topScreen && (
        <>
          <img
            src={topScreen}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full object-cover opacity-[0.18]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/10 to-bg/85"
          />
        </>
      )}
      {/* Glow ambiant teinté par le palier (léger, pour ne pas masquer la map) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[460px] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: color }}
      />

      <div className="relative">
        <div className="flex flex-col items-center gap-2 py-2">
          <LevelBadge level={level} size={72} />
          <div
            className="font-mono text-[44px] leading-none font-extrabold tracking-[-0.02em] tabular-nums"
            style={{ color, textShadow: `0 0 24px ${color}55` }}
          >
            {elo ?? "—"}
          </div>
          <div className="text-[11px] tracking-[0.18em] text-ink-faint uppercase">Elo Faceit</div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-8 border-t border-white/[0.06] pt-4 text-sm text-ink-dim">
          <span>
            <span className="font-mono font-bold text-ink tabular-nums">{total}</span> matchs
          </span>
          <span>
            <span className="font-mono font-bold text-win tabular-nums">
              {winrate != null ? `${winrate}%` : "—"}
            </span>{" "}
            victoires
          </span>
        </div>
      </div>
    </Card>
  );
}
