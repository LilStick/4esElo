import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TbChevronRight, TbTrophy } from "react-icons/tb";
import { getPlayerAchievements } from "../lib/api";
import { Card, Skeleton } from "../ui";

/** Résumé « Succès » sur le profil (B7.9) → aperçu + lien vers la page dédiée. */
export function AchievementsSummary({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["achievements", id],
    queryFn: () => getPlayerAchievements(id),
  });

  const items = data?.achievements ?? [];
  const unlocked = items.filter((a) => a.unlocked);

  return (
    <Link to={`/player/${id}/succes`} className="group block">
      <Card className="flex items-center gap-3 p-4 transition-colors group-hover:border-brand/30">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <TbTrophy size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Succès</div>
          {isLoading ? (
            <Skeleton className="mt-1 h-3 w-24" />
          ) : (
            <div className="text-xs text-ink-faint">
              {unlocked.length} / {items.length} débloqués
            </div>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {unlocked.slice(0, 3).map((a) => (
            <span key={a.id} className="text-lg leading-none">
              {a.emoji}
            </span>
          ))}
        </span>
        <TbChevronRight
          size={18}
          className="shrink-0 text-ink-faint transition-colors group-hover:text-ink"
        />
      </Card>
    </Link>
  );
}
