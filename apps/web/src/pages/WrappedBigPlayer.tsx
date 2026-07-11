import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { TbArrowLeft, TbSparkles } from "react-icons/tb";
import { getPlayerBigWrapped } from "../lib/api";
import { parseBigPeriod, bigPeriodLabel } from "../lib/period";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Card, MapIcon, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { MapBackdrop } from "../components/MapBackdrop";
import { mapScreen } from "../lib/mapScreens";
import { cn } from "../lib/cn";
import { useTitle } from "../lib/useTitle";
import fallbackScreen from "../assets/maps/screens/de_dust2.png";

const prettyMap = (m: string) => m.replace(/^de_/, "").replace(/^\w/, (c) => c.toUpperCase());
const fmtPlaytime = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h${m ? ` ${m}` : ""}` : `${m} min`;
};

function Tile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <Card className="p-4">
      <div className={cn("font-mono text-2xl font-extrabold tabular-nums", accent ?? "text-ink")}>
        {value}
      </div>
      <div className="mt-1 text-[10px] tracking-[0.14em] text-ink-faint uppercase">{label}</div>
    </Card>
  );
}

function Percentile({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink-dim">{label}</span>
        <span className="font-mono font-bold text-brand tabular-nums">
          top {Math.max(1, 100 - Math.round(value))}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(value)}%` }} />
      </div>
    </div>
  );
}

export function WrappedBigPlayer() {
  const { period = "", player = "" } = useParams();
  const p = parseBigPeriod(period);
  const reduce = useReducedMotion();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["big-wrapped", period, player],
    queryFn: () => getPlayerBigWrapped(period, player),
    enabled: !!p && !!player,
  });
  useTitle(`BIG Wrapped · ${data?.nickname ?? ""}`);

  const label = p ? bigPeriodLabel(p) : period;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={`/wrapped/big/${period}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
      >
        <TbArrowLeft size={16} /> BIG Wrapped du pôle
      </Link>

      {(!p || isError) && (
        <div className="mt-6">
          <EmptyState icon={TbSparkles} title="Wrapped indisponible">
            Impossible de charger ce BIG Wrapped.
          </EmptyState>
        </div>
      )}

      {p && isLoading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-20" />
            </Card>
          ))}
        </div>
      )}

      {p && data && (
        <div className="mt-6 flex flex-col gap-6">
          {/* Hero */}
          <Card className="relative overflow-hidden p-6 text-center sm:p-8">
            <MapBackdrop src={(data.topMap && mapScreen(data.topMap.map)) || fallbackScreen} />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand/12 to-transparent"
            />
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative flex flex-col items-center gap-3"
            >
              <Avatar
                name={data.nickname}
                size={72}
                src={discordAvatarUrl(data.discordId, data.discordAvatar)}
              />
              <div>
                <h1 className="text-2xl font-extrabold tracking-[-0.03em]">{data.nickname}</h1>
                <p className="text-sm text-ink-dim">BIG Wrapped · {label}</p>
              </div>
            </motion.div>
          </Card>

          {data.matches === 0 ? (
            <EmptyState icon={TbSparkles} title="Aucun match sur la période">
              {data.nickname} n'a pas joué en {label}.
            </EmptyState>
          ) : (
            <>
              {/* Chiffres de la période */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Tile label="Matchs" value={data.matches} />
                <Tile
                  label="Victoires"
                  value={`${data.wins} · ${Math.round(data.winRate)}%`}
                  accent="text-win"
                />
                <Tile
                  label="Δ ELO période"
                  value={data.elo ? `${data.elo.delta > 0 ? "+" : ""}${data.elo.delta}` : "—"}
                  accent={data.elo ? (data.elo.delta >= 0 ? "text-win" : "text-loss") : undefined}
                />
                <Tile
                  label="Temps de jeu"
                  value={data.playtimeMinutes != null ? fmtPlaytime(data.playtimeMinutes) : "privé"}
                />
                <Card className="flex items-center gap-3 p-4 sm:col-span-2">
                  {data.topMap ? (
                    <>
                      <MapIcon map={data.topMap.map} size={34} />
                      <div>
                        <div className="font-semibold">{prettyMap(data.topMap.map)}</div>
                        <div className="text-xs text-ink-dim">
                          Map signature · {data.topMap.matches} matchs · {Math.round(data.topMap.winRate)}% WR
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-ink-dim">Pas de map signature</div>
                  )}
                </Card>
              </div>

              {/* Percentiles vs pôle */}
              {data.percentiles && (
                <div>
                  <div className="mb-3 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
                    Face au pôle
                  </div>
                  <Card className="flex flex-col gap-3 p-5">
                    <Percentile label="Matchs joués" value={data.percentiles.matches} />
                    <Percentile label="Winrate" value={data.percentiles.winRate} />
                    <Percentile label="K/D" value={data.percentiles.kd} />
                    <Percentile label="ADR" value={data.percentiles.adr} />
                  </Card>
                </div>
              )}

              {/* Awards perso */}
              {data.awards.length > 0 && (
                <div>
                  <div className="mb-3 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
                    Ses awards
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data.awards.map((a, i) => (
                      <Card key={`${a.award}-${i}`} accent className="flex flex-col gap-2 p-5">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl leading-none">{a.emoji}</span>
                          <div className="font-bold">{a.title}</div>
                        </div>
                        <p className="text-sm text-ink-dim italic">« {a.punchline} »</p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
