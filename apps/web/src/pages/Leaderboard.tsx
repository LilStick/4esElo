import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { TbArrowRight, TbCrown, TbSearch, TbUsersGroup } from "react-icons/tb";
import type { LeaderboardEntry } from "@4eselo/types";
import { getLeaderboard, getMovers } from "../lib/api";
import { Avatar, Card, HoverBarList, LevelBadge, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { cn } from "../lib/cn";
import { useTitle } from "../lib/useTitle";

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

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const first = entry.rank === 1;
  return (
    <Link
      to={`/player/${entry.id}`}
      className="group block rounded-[var(--r-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      <Card
        outerClassName={cn(
          "transition-[border-color] duration-200 group-hover:border-white/20",
          first &&
            "-translate-y-4 shadow-[0_0_40px_-14px_rgba(94,139,255,0.45),0_24px_60px_-30px_rgba(0,0,0,0.9)]",
        )}
        className="relative p-4 text-center sm:p-5"
      >
        {first && (
          <TbCrown
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-brand drop-shadow-[0_0_8px_rgba(94,139,255,0.5)]"
            size={22}
          />
        )}
        <span className="absolute top-1.5 left-2 font-mono text-xs font-bold text-ink-faint">
          #{entry.rank}
        </span>
        <div className="mx-auto mt-1.5 mb-3 w-fit">
          <Avatar name={nameOf(entry)} size={60} />
        </div>
        <div className="truncate text-[15px] font-bold">{nameOf(entry)}</div>
        <div className="mt-2 flex justify-center">
          <LevelBadge level={entry.level} size={26} />
        </div>
        <div className="mt-2 font-mono text-[23px] font-extrabold text-brand tabular-nums transition-colors group-hover:text-brand-hi">
          {entry.elo ?? "—"}
        </div>
      </Card>
    </Link>
  );
}

function LeaderboardSkeleton() {
  return (
    <>
      <div className="mb-4 grid grid-cols-3 items-end gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <Card
            key={i}
            outerClassName={i === 1 ? "-translate-y-4" : undefined}
            className="flex flex-col items-center gap-3 p-5"
          >
            <Skeleton className="size-[60px] rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="size-[26px] rounded-lg" />
            <Skeleton className="h-5 w-14" />
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-2 p-[var(--bezel)]">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-2.5">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="size-[34px] rounded-full" />
            <Skeleton className="size-6 rounded-md" />
            <Skeleton className="h-4 flex-1 max-w-[160px]" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </Card>
    </>
  );
}

const SORTS = [
  { key: "elo", label: "ELO" },
  { key: "level", label: "Niveau" },
] as const;
type Sort = (typeof SORTS)[number]["key"];

export function Leaderboard() {
  useTitle("Classement");
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>("elo");
  const [q, setQ] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard", "faceit"],
    queryFn: () => getLeaderboard("faceit"),
  });
  const { data: moversData } = useQuery({ queryKey: ["movers", "7d"], queryFn: () => getMovers("7d") });
  const eloMove = useMemo(
    () => new Map((moversData?.movers ?? []).map((m) => [m.id, m.delta])),
    [moversData],
  );

  const board = data?.leaderboard ?? [];
  const byLevel = sort === "level";
  const searching = q.trim() !== "";
  // Podium = toujours le top 3 ELO ; tri par niveau ou recherche → liste plate.
  const ordered = byLevel
    ? [...board].sort((a, b) => (b.level ?? -1) - (a.level ?? -1) || (b.elo ?? -1) - (a.elo ?? -1))
    : board;
  const [first, second, third] = board;
  const hasPodium = !byLevel && !searching && Boolean(first && second && third);
  const listItems = searching
    ? ordered.filter((e) => norm(nameOf(e)).includes(norm(q.trim())))
    : byLevel
      ? ordered
      : hasPodium
        ? board.slice(3)
        : board;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classement</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Membres du pôle CS2, triés par {byLevel ? "niveau" : "ELO"} Faceit.
          </p>
        </div>
        <div className="inline-flex gap-1 rounded-full border border-white/[0.09] bg-white/[0.03] p-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
                sort === s.key ? "bg-brand text-[#060a18]" : "text-ink-dim hover:text-ink",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

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

      {hasPodium && first && second && third && (
        <div className="mt-5 mb-4 grid grid-cols-3 items-end gap-3 sm:gap-4">
          <PodiumCard entry={second} />
          <PodiumCard entry={first} />
          <PodiumCard entry={third} />
        </div>
      )}

      {listItems.length > 0 && (
        <Card className="p-[var(--bezel)]">
          <HoverBarList
            items={listItems}
            rowHeight={56}
            keyOf={(e) => e.id}
            onSelect={(e) => navigate(`/player/${e.id}`)}
            children={(e) => (
              <>
                <span className="w-5 text-center font-mono font-bold text-ink-faint">{e.rank}</span>
                <EloDelta delta={eloMove.get(e.id)} />
                <Avatar name={nameOf(e)} size={34} />
                <LevelBadge level={e.level} size={24} />
                <span className="flex-1 truncate font-semibold">{nameOf(e)}</span>
                <span className="font-mono text-[15px] font-bold text-brand tabular-nums">
                  {e.elo ?? "—"}
                </span>
                <TbArrowRight className="text-ink-faint" size={17} />
              </>
            )}
          />
        </Card>
      )}

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
