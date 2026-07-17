import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { TbArrowRight, TbCrown, TbMap2, TbSearch, TbUsersGroup } from "react-icons/tb";
import type { LeaderboardEntry } from "@4eselo/types";
import { getLeaderboard, getMovers } from "../lib/api";
import { useMe } from "../lib/useMe";
import { useEloSource } from "../lib/useEloSource";
import { usePremierEnabled } from "../lib/usePremierEnabled";
import { discordAvatarUrl } from "../lib/discord";
import { isAlumni } from "../lib/promo";
import { premierRangeLabel, premierTier } from "../lib/premierTier";
import { Avatar, Card, HoverBarList, LevelBadge, PremierBadge, Skeleton, SourceToggle } from "../ui";
import { Badges } from "../components/Badges";
import { EmptyState } from "../components/EmptyState";
import { Sparkline } from "../components/Sparkline";
import { MapBackdrop } from "../components/MapBackdrop";
import { cn } from "../lib/cn";
import { useTitle } from "../lib/useTitle";
import backdrop from "../assets/maps/screens/de_mirage.png";

// Pseudo Discord en priorité (identifier qui est qui), Faceit en secours.
const nameOf = (e: LeaderboardEntry) => e.discordName ?? e.faceitNickname ?? "-";

/** Delta d'ELO sur 7 j (±points), entre le rang et l'avatar - « - » si nul / non suivi. */
function EloDelta({ delta }: { delta: number | null | undefined }) {
  if (delta == null || delta === 0) {
    return <span className="w-10 text-center font-mono text-xs text-ink-faint">-</span>;
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

/** Regroupe par palier CS Rating Premier (bandes de 5000), du plus haut au plus bas. */
function groupByPremierTier(
  items: LeaderboardEntry[],
): { name: string; min: number; color: string; items: LeaderboardEntry[] }[] {
  const map = new Map<string, { name: string; min: number; color: string; items: LeaderboardEntry[] }>();
  for (const e of items) {
    const t = premierTier(e.elo ?? 0);
    const g = map.get(t.name);
    if (g) g.items.push(e);
    else map.set(t.name, { name: t.name, min: t.min, color: t.color, items: [e] });
  }
  return [...map.values()].sort((a, b) => b.min - a.min);
}

/** Bandeau de palier Premier : pastille couleur + plage de rating. */
function PremierTierBanner({ min, count }: { min: number; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      {/* Icône du rang au palier (seuil affiché dans le badge, ex. 30 000+). */}
      <PremierBadge rating={min} height={22} />
      <span className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        {premierRangeLabel(min)}
      </span>
      <span className="ml-auto font-mono text-[11px] text-ink-faint tabular-nums">{count}</span>
    </div>
  );
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
  const [source, setSource] = useEloSource();
  const premierEnabled = usePremierEnabled();
  const premier = source === "premier";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard", source, "spark12"],
    queryFn: () => getLeaderboard(source, 12),
  });
  const { data: moversData } = useQuery({
    queryKey: ["movers", "7d", source],
    queryFn: () => getMovers("7d", source),
  });
  const eloMove = useMemo(
    () => new Map((moversData?.movers ?? []).map((m) => [m.id, m.delta])),
    [moversData],
  );
  const { player: mePlayer } = useMe();
  const myId = mePlayer?.id ?? null;

  const board = data?.leaderboard ?? [];
  const searching = q.trim() !== "";
  const listItems = searching ? board.filter((e) => norm(nameOf(e)).includes(norm(q.trim()))) : board;

  // Scroll infini : on ne rend qu'un lot de lignes, agrandi quand la sentinelle
  // approche du viewport (IntersectionObserver, pas de handler de scroll). Données
  // déjà côté client → révélation progressive du DOM, aucun refetch.
  const BATCH = 30;
  const [visible, setVisible] = useState(BATCH);
  useEffect(() => setVisible(BATCH), [q]); // reset au changement de recherche
  const shownItems = listItems.slice(0, visible);
  const hasMore = visible < listItems.length;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible((v) => Math.min(v + BATCH, listItems.length));
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, listItems.length]);

  // Paliers de niveau dès qu'on ne cherche pas — Faceit seulement (Premier n'a
  // pas de niveaux) ; sinon liste plate triée par rating/ELO.
  const grouped = !searching && !premier;
  const groups = useMemo(() => (grouped ? groupByLevel(shownItems) : []), [grouped, shownItems]);
  // Compteur par palier = total réel (indépendant de la révélation progressive).
  const totalByLevel = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of listItems) m.set(e.level ?? 0, (m.get(e.level ?? 0) ?? 0) + 1);
    return m;
  }, [listItems]);

  // Premier : groupé par palier CS Rating (bandes de 5000), comme les niveaux Faceit.
  const premierGrouped = !searching && premier;
  const premierGroups = useMemo(
    () => (premierGrouped ? groupByPremierTier(shownItems) : []),
    [premierGrouped, shownItems],
  );
  const totalByPremierName = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of listItems) {
      const n = premierTier(e.elo ?? 0).name;
      m.set(n, (m.get(n) ?? 0) + 1);
    }
    return m;
  }, [listItems]);

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
        {/* Δ7j + badge de niveau : masqués sur mobile (place au pseudo ; le niveau
            est déjà porté par le bandeau de palier). display:none retire aussi le gap. */}
        <span className="hidden sm:contents">
          <EloDelta delta={eloMove.get(e.id)} />
        </span>
        <Avatar name={nameOf(e)} size={34} src={discordAvatarUrl(e.discordId, e.discordAvatar)} />
        {/* Faceit : badge de niveau (masqué mobile). Premier : pas de niveau, le
            rang CS Rating est affiché à droite (PremierBadge). */}
        {!premier && (
          <span className="hidden sm:contents">
            <LevelBadge level={e.level} size={24} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className={cn("truncate font-semibold", (e.rank === 1 || isMe) && "text-brand-hi")}>
            {nameOf(e)}
          </span>
          <Badges tiers={e.badgeTiers} max={3} />
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
        {premier ? (
          <PremierBadge rating={e.elo ?? 0} height={22} />
        ) : (
          <span className="w-14 text-right font-mono text-[15px] font-bold text-brand tabular-nums">
            {e.elo ?? "-"}
          </span>
        )}
        <TbArrowRight className="hidden text-ink-faint sm:block" size={17} />
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
              {premier
                ? "Membres du pôle CS2, par CS Rating Premier."
                : "Membres du pôle CS2, par ELO Faceit et palier de niveau."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {premierEnabled && <SourceToggle value={source} onChange={setSource} />}
            {/* « Par map » = stats Faceit, sans objet en Premier. Même pilule que le
                toggle (rayon/bordure/hauteur) pour un alignement propre sur la ligne. */}
            {!premier && (
              <Link
                to="/classement/maps"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-ink-dim transition-colors hover:border-brand hover:text-brand-hi focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
              >
                <TbMap2 size={15} /> Par map
              </Link>
            )}
          </div>
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
                <TierBanner level={g.level} count={totalByLevel.get(g.level) ?? g.items.length} />
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
        ) : premierGrouped ? (
          <div data-tour="ladder" className="flex flex-col gap-5">
            {premierGroups.map((g) => (
              <div key={g.name}>
                <PremierTierBanner min={g.min} count={totalByPremierName.get(g.name) ?? g.items.length} />
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
              items={shownItems}
              rowHeight={56}
              keyOf={(e) => e.id}
              onSelect={(e) => navigate(`/player/${e.id}`)}
              children={renderRow}
            />
          </Card>
        ))}

      {/* Sentinelle du scroll infini : agrandit le lot quand elle approche du viewport. */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6" aria-hidden>
          <span className="size-5 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
        </div>
      )}

      {searching && board.length > 0 && listItems.length === 0 && (
        <EmptyState icon={TbSearch} title="Aucun membre trouvé">
          Aucun pseudo ne correspond à « {q.trim()} ».
        </EmptyState>
      )}

      {data && board.length === 0 && (
        <EmptyState icon={TbUsersGroup} title="Aucun joueur pour l'instant">
          {premier
            ? "Personne n'a encore lié son compte Premier — le classement CS Rating apparaîtra ici."
            : "Ajoute des membres du pôle (via le worker) et leur ELO apparaîtra ici."}
        </EmptyState>
      )}
    </div>
  );
}
