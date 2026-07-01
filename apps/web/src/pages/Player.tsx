import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TbArrowLeft, TbExternalLink, TbUserQuestion } from "react-icons/tb";
import { getPlayer } from "../lib/api";
import { Avatar, Button, Card, EloGauge, LevelBadge, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { EloChart } from "../components/EloChart";
import { useTitle } from "../lib/useTitle";

/** Bornes ELO → niveau Faceit, pour situer l'ELO dans son palier. */
const BANDS: Record<number, [number, number]> = {
  1: [100, 800],
  2: [801, 950],
  3: [951, 1100],
  4: [1101, 1250],
  5: [1251, 1400],
  6: [1401, 1550],
  7: [1551, 1700],
  8: [1701, 1850],
  9: [1851, 2000],
  10: [2001, 3000],
};

function eloPct(elo: number | null, level: number | null): number {
  if (elo == null || level == null) return 0;
  const band = BANDS[level];
  if (!band) return 0;
  const [lo, hi] = band;
  return Math.min(100, Math.max(6, ((elo - lo) / (hi - lo)) * 100));
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-[18px]">
      <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">{label}</div>
      <div className="mt-2 font-mono text-2xl font-extrabold tracking-tight tabular-nums">{value}</div>
    </Card>
  );
}

function PlayerSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <Skeleton className="size-[78px] rounded-[20px]" />
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="ml-auto">
          <Skeleton className="h-10 w-24" />
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center justify-center p-5">
          <Skeleton className="size-[140px] rounded-full" />
        </Card>
        <Card className="p-5 sm:col-span-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-[190px] w-full rounded-xl" />
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="p-[18px]">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-20" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Player() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["player", id],
    queryFn: () => getPlayer(id),
    enabled: id.length > 0,
  });

  const name = data?.faceitNickname ?? data?.discordName ?? "Joueur";
  useTitle(name);
  const elos = data?.history.map((h) => h.elo) ?? [];
  const peak = elos.length ? Math.max(...elos) : null;
  const low = elos.length ? Math.min(...elos) : null;
  const first = elos.at(0);
  const last = elos.at(-1);
  const delta = first != null && last != null ? last - first : null;

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink">
        <TbArrowLeft size={16} /> Classement
      </Link>

      {isLoading && <PlayerSkeleton />}
      {isError && (
        <EmptyState
          icon={TbUserQuestion}
          title="Joueur introuvable"
          action={<Button onClick={() => navigate("/")}>Retour au classement</Button>}
        >
          Ce joueur n'existe pas ou n'est plus suivi.
        </EmptyState>
      )}

      {data && (
        <div className="mt-6 flex flex-col gap-4">
          {/* Header */}
          <Card className="flex flex-wrap items-center gap-5 p-5">
            <Avatar name={name} size={78} />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[27px] font-extrabold tracking-[-0.03em]">
                <span className="truncate">{name}</span>
                <LevelBadge level={data.level} size={26} />
              </h1>
              <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-ink-dim">
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
            <div className="ml-auto text-right">
              <div className="font-mono text-[42px] font-extrabold tracking-[-0.03em] text-brand tabular-nums [text-shadow:0_0_24px_rgba(94,139,255,0.4)]">
                {data.elo ?? "—"}
              </div>
              <div className="text-[11px] tracking-[0.16em] text-ink-faint uppercase">ELO Faceit</div>
            </div>
          </Card>

          {/* Jauge + courbe */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="flex flex-col items-center justify-center gap-3 p-5">
              <EloGauge elo={data.elo ?? 0} pct={eloPct(data.elo, data.level)} size={140} />
              <div className="text-[11px] tracking-[0.12em] text-ink-faint uppercase">Progression du palier</div>
            </Card>

            <Card className="p-5 sm:col-span-2">
              <div className="mb-4 flex items-baseline justify-between">
                <div className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
                  Évolution de l'ELO
                </div>
                {delta != null && (
                  <span
                    className={`font-mono text-[13px] font-bold tabular-nums ${delta >= 0 ? "text-win" : "text-loss"}`}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta}
                  </span>
                )}
              </div>
              <EloChart points={data.history} />
            </Card>
          </div>

          {/* Repères */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="ELO actuel" value={data.elo ?? "—"} />
            <Stat label="Pic" value={peak ?? "—"} />
            <Stat label="Plus bas" value={low ?? "—"} />
            <Stat label="Points" value={data.history.length} />
          </div>
        </div>
      )}
    </div>
  );
}
