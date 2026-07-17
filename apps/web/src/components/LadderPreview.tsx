import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { TbArrowRight, TbTrophy } from "react-icons/tb";
import type { LeaderboardEntry } from "@4eselo/types";
import { getLeaderboard } from "../lib/api";
import { useEloSource } from "../lib/useEloSource";
import { usePremierEnabled } from "../lib/usePremierEnabled";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Card, HoverBarList, LevelBadge, PremierBadge, Skeleton, SourceToggle } from "../ui";
import { Badges } from "./Badges";

const nameOf = (e: LeaderboardEntry) => e.discordName ?? e.faceitNickname ?? "-";

/** Aperçu du classement sur le home : ladder simple (top 5) + ligne « +N autres » vers le complet. */
export function LadderPreview({ top = 5 }: { top?: number }) {
  const navigate = useNavigate();
  const [source, setSource] = useEloSource();
  const premierEnabled = usePremierEnabled();
  const premier = source === "premier";
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", source],
    queryFn: () => getLeaderboard(source),
  });
  const board = data?.leaderboard ?? [];
  const items = board.slice(0, top);
  const rest = Math.max(0, board.length - top);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
          <TbTrophy size={14} className="text-brand" />
          Classement
        </div>
        {premierEnabled && <SourceToggle value={source} onChange={setSource} />}
      </div>

      {isLoading ? (
        <Card className="flex flex-col gap-1 p-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5">
              <Skeleton className="h-4 w-5" />
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 max-w-40 flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </Card>
      ) : items.length > 0 ? (
        <Card className="p-2">
          <HoverBarList
            items={items}
            rowHeight={52}
            keyOf={(e) => e.id}
            onSelect={(e) => navigate(`/player/${e.id}`)}
            children={(e) => (
              <>
                <span className="w-5 text-center font-mono font-bold text-ink-faint">{e.rank}</span>
                <Avatar name={nameOf(e)} size={32} src={discordAvatarUrl(e.discordId, e.discordAvatar)} />
                {!premier && <LevelBadge level={e.level} size={22} />}
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate font-semibold">{nameOf(e)}</span>
                  <Badges tiers={e.badgeTiers} max={2} />
                </span>
                {premier ? (
                  <PremierBadge rating={e.elo ?? 0} height={20} />
                ) : (
                  <span className="font-mono text-sm font-bold text-brand tabular-nums">{e.elo ?? "-"}</span>
                )}
              </>
            )}
          />
          <Link
            to="/classement"
            className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border-t border-white/[0.06] py-3 text-sm font-semibold text-ink-dim transition-colors hover:bg-white/[0.03] hover:text-brand-hi"
          >
            {rest > 0 ? `Voir les ${rest} autres membres` : "Voir le classement complet"}
            <TbArrowRight size={15} />
          </Link>
        </Card>
      ) : (
        <Card className="p-6 text-center text-sm text-ink-dim">Aucun joueur pour l'instant.</Card>
      )}
    </section>
  );
}
