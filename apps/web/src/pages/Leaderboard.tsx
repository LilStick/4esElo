import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { TbArrowRight, TbCrown, TbMap2, TbSearch, TbUsersGroup } from "react-icons/tb";
import type { LeaderboardEntry } from "@4eselo/types";
import { getLeaderboard, getMovers } from "../lib/api";
import { useMe } from "../lib/useMe";
import { discordAvatarUrl } from "../lib/discord";
import { isAlumni } from "../lib/promo";
import { Avatar, Card, HoverBarList, LevelBadge, Skeleton } from "../ui";
import { Badges } from "../components/Badges";
import { EmptyState } from "../components/EmptyState";
import { Sparkline } from "../components/Sparkline";
import { MapBackdrop } from "../components/MapBackdrop";
import { cn } from "../lib/cn";
import { useTitle } from "../lib/useTitle";
import backdrop from "../assets/maps/screens/de_mirage.png";

const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "—";

/** Delta d'ELO sur 7 j (±points), entre le rang et l'avatar — « – » si nul / non suivi. */
function EloDelta({ delta }: { delta: number | null | undefined }) {
  if (delta == null || delta === 0) {
    return <span className="w-10 text-center font-mono text-xs text-ink-faint">–</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "w-10 text-center font-mono text-xs font-bold tabular-nums",
        up ? "text-win" : "text-loss",
      )}
      title="Δ ELO sur 7 j"
    >
      {up ? "+" : ""}
      {delta}
    </span>
  );
}
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Regroupe les entrées par niveau Faceit, paliers du plus haut au plus bas. */
function groupByLevel(items: LeaderboardEntry[]): { level: number; items: LeaderboardEntry[] }[] {
  const map = new Map<number, LeaderboardEntry[]>();
  for (const e of items) {
    const lvl = e.level ?? 0;
    const arr = map.get(lvl);
    if (arr) arr.push(e);
    else map.set(lvl, [e]);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([level, items]) => ({ level, items }));
}

/** Bandeau de palier entre les groupes de niveau. */
function TierBanner({ level, count }: { level: number; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <LevelBadge level={level || null} size={20} />
      <span className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        {level ? `Niveau ${level}` : "Sans niveau"}
      </span>
      <span className="ml-auto font-mono text-[11px] text-ink-faint tabular-nums">{count}</span>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <Card className="flex flex-col gap-2 p-[var(--bezel)]">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-2.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="size-[34px] rounded-full" />
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-4 max-w-[160px] flex-1" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </Card>
  );
}

export function Leaderboard() {
  useTitle("Classement");
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard", "faceit", "spark12"],
    queryFn: () => getLeaderboard("faceit", 12),
  });
  const { data: moversData } = useQuery({ queryKey: ["movers", "7d"], queryFn: () => getMovers("7d") });
  const eloMove = useMemo(
    () => new Map((moversData?.movers ?? []).map((m) => [m.id, m.delta])),
    [moversData],
  );
  const { player: mePlayer } = useMe();
  const myId = mePlayer?.id ?? null;

  const board = data?.leaderboard ?? [];
  const searching = q.trim() !== "";
  const listItems = searching ? board.filter((e) => norm(nameOf(e)).includes(norm(q.trim()))) : board;

  // Paliers de niveau dès qu'on ne cherche pas ; liste plate en recherche.
  const grouped = !searching;
  const groups = useMemo(() => (grouped ? groupByLevel(listItems) : []), [grouped, listItems]);

  const renderRow = (e: LeaderboardEntry) => {
    const isMe = myId != null && e.id === myId;
    return (
      <>
        {isMe && (
          <span
            aria-hidden
            className="absolute top-1/2 left-0 h-7 w-[3px] -translate-y-1/2 rounded-full bg-brand shadow-[0_0_10px_rgba(94,139,255,0.6)]"
          />
        )}
        <span className="grid w-5 place-items-center font-mono font-bold text-ink-faint">
          {e.rank === 1 ? (
            <TbCrown className="text-brand drop-shadow-[0_0_6px_rgba(94,139,255,0.55)]" size={17} />
          ) : (
            e.rank
          )}
        </span>
        <EloDelta delta={eloMove.get(e.id)} />
        <Avatar name={nameOf(e)} size={34} src={discordAvatarUrl(e.discordId, e.discordAvatar)} />
        <LevelBadge level={e.level} size={24} />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className={cn("truncate font-semibold", (e.rank === 1 || isMe) && "text-brand-hi")}>
            {nameOf(e)}
          </span>
          <Badges ids={e.badges} max={3} />
        </span>
        {isAlumni(e.promoEnd) && (
          <span title="Alumni" aria-label="Alumni" className="shrink-0 text-[13px] leading-none">
            🎓
          </span>
        )}
        {isMe && (
          <span className="rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand-hi uppercase">
            toi
          </span>
        )}
        {e.sparkline && e.sparkline.length > 1 && (
          <Sparkline points={e.sparkline} className="hidden shrink-0 sm:block" />
        )}
        <span className="w-14 text-right font-mono text-[15px] font-bold text-brand tabular-nums">
          {e.elo ?? "—"}
        </span>
        <TbArrowRight className="text-ink-faint" size={17} />
      </>
    );
  };

  return (
    <div>
      <Card outerClassName="mb-6" className="relative overflow-hidden p-6">
        <MapBackdrop src={backdrop} />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Classement</h1>
            <p className="mt-1 text-sm text-ink-dim">
              Membres du pôle CS2, par ELO Faceit et palier de niveau.
            </p>
          </div>
          <Link
            to="/classement/maps"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-ink-dim transition-colors hover:border-brand hover:text-brand-hi focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
          >
            <TbMap2 size={16} /> Par map
          </Link>
        </div>
      </Card>

      {!isLoading && !isError && board.length > 0 && (
        <div className="relative mb-4">
          <TbSearch
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
            size={16}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un membre…"
            className="w-full rounded-xl border border-white/[0.09] bg-white/[0.02] py-2.5 pr-3 pl-9 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand/60"
          />
        </div>
      )}

      {isLoading && <LeaderboardSkeleton />}
      {isError && <p className="text-loss">Impossible de charger le classement. L'API tourne-t-elle ?</p>}

      {listItems.length > 0 &&
        (grouped ? (
          <div data-tour="ladder" className="flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.level}>
                <TierBanner level={g.level} count={g.items.length} />
                <Card className="p-[var(--bezel)]">
                  <HoverBarList
                    items={g.items}
                    rowHeight={56}
                    keyOf={(e) => e.id}
                    onSelect={(e) => navigate(`/player/${e.id}`)}
                    children={renderRow}
                  />
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-[var(--bezel)]">
            <HoverBarList
              items={listItems}
              rowHeight={56}
              keyOf={(e) => e.id}
              onSelect={(e) => navigate(`/player/${e.id}`)}
              children={renderRow}
            />
          </Card>
        ))}

      {searching && board.length > 0 && listItems.length === 0 && (
        <EmptyState icon={TbSearch} title="Aucun membre trouvé">
          Aucun pseudo ne correspond à « {q.trim()} ».
        </EmptyState>
      )}

      {data && board.length === 0 && (
        <EmptyState icon={TbUsersGroup} title="Aucun joueur pour l'instant">
          Ajoute des membres du pôle (via le worker) et leur ELO apparaîtra ici.
        </EmptyState>
      )}
    </div>
  );
}
