import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TbRefresh } from "react-icons/tb";
import type { EloPoint, EloSource } from "@4eselo/types";
import { ApiError, getPlayerMatches, refreshPlayerElo } from "../lib/api";
import { mapScreen } from "../lib/mapScreens";
import { premierTier } from "../lib/premierTier";
import { cn } from "../lib/cn";
import { Card, CountUp, LevelBadge, PremierBadge } from "../ui";

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
export function EloSummaryCard({
  id,
  elo,
  level,
  source = "faceit",
  history = [],
}: {
  id: string;
  elo: number | null;
  level: number | null;
  source?: EloSource;
  history?: EloPoint[];
}) {
  const premier = source === "premier";
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const { data } = useQuery({
    queryKey: ["matches", id, 50],
    queryFn: () => getPlayerMatches(id, 50),
    enabled: !premier, // Premier n'a pas de matchs stockés → pas de fetch Faceit.
  });

  const refresh = useMutation({
    mutationFn: () => refreshPlayerElo(id),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["player", id] });
      setMsg({ text: res.changed ? "ELO mis à jour" : "Déjà à jour", tone: "ok" });
    },
    onError: (e) => {
      const status = e instanceof ApiError ? e.status : 0;
      setMsg({
        text: status === 429 ? "Déjà à jour, réessaie dans 1 min" : "Échec, réessaie plus tard",
        tone: "warn",
      });
    },
    onSettled: () => {
      window.setTimeout(() => setMsg(null), 3500);
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const wins = items.filter((m) => m.result === 1).length;
  const winrate = items.length ? Math.round((wins / items.length) * 100) : null;
  const color = premier ? premierTier(elo ?? 0).color : levelColor(level);

  // Premier : pas de matchs → stats dérivées de la courbe (pic + progression).
  const pts = history.map((h) => h.elo);
  const peak = pts.length ? Math.max(...pts) : elo;
  const prog = pts.length >= 2 ? pts[pts.length - 1]! - pts[0]! : null;

  // Fond : map la plus jouée (Faceit) ; en Premier, une map par défaut.
  const topScreen = useMemo(() => {
    if (premier) return mapScreen("de_ancient");
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
  }, [data, premier]);

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

      {/* Rafraîchir l'ELO à la demande (B16.10). En Premier : synchro auto (worker) → bouton inactif. */}
      <button
        onClick={() => !premier && refresh.mutate()}
        disabled={premier || refresh.isPending}
        aria-label={premier ? "Synchro automatique" : "Rafraîchir l'ELO"}
        title={premier ? "Premier : synchro automatique" : "Rafraîchir l'ELO"}
        className="absolute top-3 right-3 z-10 grid size-9 cursor-pointer place-items-center rounded-lg border border-white/[0.12] bg-white/[0.04] text-ink-dim transition-colors hover:border-brand hover:text-brand-hi focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none disabled:cursor-default disabled:opacity-50"
      >
        <TbRefresh size={16} className={refresh.isPending ? "animate-spin" : ""} />
      </button>
      {msg && (
        <div
          className={cn(
            "absolute top-14 right-3 z-10 rounded-md px-2 py-1 text-[11px] font-semibold",
            msg.tone === "ok" ? "bg-win/15 text-win" : "bg-loss/15 text-loss",
          )}
        >
          {msg.text}
        </div>
      )}

      <div className="relative">
        <div className="flex flex-col items-center gap-2 py-2">
          {premier ? (
            <>
              <PremierBadge rating={elo ?? 0} height={64} />
              <div className="text-[11px] tracking-[0.18em] text-ink-faint uppercase">CS Rating Premier</div>
            </>
          ) : (
            <>
              <LevelBadge level={level} size={72} />
              <div
                className="font-mono text-[44px] leading-none font-extrabold tracking-[-0.02em] tabular-nums"
                style={{ color, textShadow: `0 0 24px ${color}55` }}
              >
                {elo != null ? <CountUp value={elo} /> : "-"}
              </div>
              <div className="text-[11px] tracking-[0.18em] text-ink-faint uppercase">Elo Faceit</div>
            </>
          )}
        </div>

        <div className="mt-3 flex items-center justify-center gap-8 border-t border-white/[0.06] pt-4 text-sm text-ink-dim">
          {premier ? (
            <>
              <span>
                <span className="font-mono font-bold text-ink tabular-nums">{peak ?? "-"}</span> pic
              </span>
              <span>
                <span
                  className={cn(
                    "font-mono font-bold tabular-nums",
                    prog == null ? "text-ink" : prog >= 0 ? "text-win" : "text-loss",
                  )}
                >
                  {prog != null ? `${prog >= 0 ? "+" : ""}${prog}` : "-"}
                </span>{" "}
                progression
              </span>
            </>
          ) : (
            <>
              <span>
                <span className="font-mono font-bold text-ink tabular-nums">{total}</span> matchs
              </span>
              <span>
                <span className="font-mono font-bold text-win tabular-nums">
                  {winrate != null ? `${winrate}%` : "-"}
                </span>{" "}
                victoires
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
