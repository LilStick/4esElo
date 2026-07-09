import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { TbArrowLeft, TbCheck, TbTrophy } from "react-icons/tb";
import type { AchievementState } from "@4eselo/types";
import { getPlayer, getPlayerAchievements } from "../lib/api";
import { Card, Skeleton } from "../ui";
import { cn } from "../lib/cn";
import { fullDate } from "../lib/relativeTime";
import { useTitle } from "../lib/useTitle";

/** Tuile de succès (horizontale) : icône + titre (✓ si débloqué) + condition ; grisée si verrouillée. */
function Tile({ a }: { a: AchievementState }) {
  const pct = a.target > 0 ? Math.min(100, Math.round((a.current / a.target) * 100)) : 0;
  return (
    <Card className={cn("flex items-center gap-3 p-4", !a.unlocked && "opacity-60")}>
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl text-2xl leading-none",
          a.unlocked ? "bg-brand/10" : "bg-white/[0.03] grayscale",
        )}
      >
        {a.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-sm font-bold", a.unlocked ? "text-ink" : "text-ink-dim")}>
            {a.label}
          </span>
          {a.unlocked && <TbCheck size={14} className="shrink-0 text-win" />}
        </div>
        <div className="truncate text-xs text-ink-faint">{a.description}</div>
        {a.unlocked ? (
          <div className="mt-0.5 text-[11px] text-ink-faint">
            {a.unlockedAt ? `Débloqué le ${fullDate(a.unlockedAt)}` : "Débloqué"}
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <span className="block h-full rounded-full bg-brand/60" style={{ width: `${pct}%` }} />
            </span>
            <span className="shrink-0 font-mono text-[10px] text-ink-faint tabular-nums">
              {a.current}/{a.target}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Page dédiée « Succès » d'un joueur (B7.9) — en-tête + progression globale + grille de tuiles. */
export function Achievements() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: player } = useQuery({
    queryKey: ["player", id],
    queryFn: () => getPlayer(id),
    enabled: !!id,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["achievements", id],
    queryFn: () => getPlayerAchievements(id),
    enabled: !!id,
  });

  const name = player?.faceitNickname ?? player?.discordName ?? "Joueur";
  useTitle(`Succès — ${name}`);

  const items = data?.achievements ?? [];
  const unlocked = items.filter((a) => a.unlocked).length;
  const pct = items.length ? Math.round((unlocked / items.length) * 100) : 0;
  const sorted = [...items].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return Number(b.unlocked) - Number(a.unlocked);
    if (a.unlocked && b.unlocked) return (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "");
    return b.current / b.target - a.current / a.target;
  });

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
      >
        <TbArrowLeft size={16} /> Retour
      </button>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
          <TbTrophy size={24} />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">Succès</h1>
          <p className="text-sm text-ink-dim">
            {name} · {unlocked} / {items.length} débloqués
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
          <span>Progression</span>
          <span className="font-mono tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Card key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1.5 h-3 w-32" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((a) => (
            <Tile key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
