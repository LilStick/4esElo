import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import { TbDeviceGamepad2, TbSwords } from "react-icons/tb";
import type { PresenceEntry } from "@4eselo/types";
import { getPresence } from "../lib/api";
import { Avatar, Card, HoverBarList, Skeleton } from "../ui";
import { cn } from "../lib/cn";

const nameOf = (p: PresenceEntry) => p.faceitNickname ?? p.discordName ?? "—";

type Status = { rank: number; label: string; text: string; dot: string; pulse: boolean; icon?: IconType };

function Header() {
  return (
    <div className="flex items-center gap-2 px-4 pt-2 pb-1 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
      <TbDeviceGamepad2 size={14} className="shrink-0 text-brand" />
      En jeu maintenant
    </div>
  );
}

/**
 * Statut le plus précis d'un membre (B15.8), du plus fort au plus faible :
 * match Faceit confirmé > en jeu CS2 > en ligne ; sinon null (masqué).
 * `inFaceitMatch` n'est truthy que si `=== true` : null (vérif impossible) ou
 * false retombent sur « En jeu CS2 » — jamais de mention Faceit non confirmée.
 */
function statusOf(p: PresenceEntry): Status | null {
  if (p.inFaceitMatch)
    return {
      rank: 0,
      label: "En match Faceit",
      text: "text-brand-hi",
      dot: "bg-brand",
      pulse: true,
      icon: TbSwords,
    };
  if (p.inGameCs2)
    return {
      rank: 1,
      label: "En jeu CS2",
      text: "text-win",
      dot: "bg-win",
      pulse: true,
      icon: TbDeviceGamepad2,
    };
  if (p.online)
    return { rank: 2, label: "En ligne", text: "text-ink-dim", dot: "bg-ink-faint", pulse: false };
  return null;
}

/** Widget « En jeu maintenant » : liste complète des membres actifs. Rafraîchi 60 s. */
export function LivePresence() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["presence"],
    queryFn: getPresence,
    refetchInterval: 60_000,
  });

  const active = (data?.players ?? [])
    .map((p) => ({ p, s: statusOf(p) }))
    .filter((x): x is { p: PresenceEntry; s: Status } => x.s !== null)
    .sort((a, b) => a.s.rank - b.s.rank);

  if (isLoading) {
    return (
      <Card className="p-2">
        <Header />
        <div className="flex items-center gap-3 px-4 py-2">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        </div>
      </Card>
    );
  }

  if (active.length === 0) {
    return (
      <Card className="p-2">
        <Header />
        <div className="px-4 py-4 text-sm text-ink-dim">Personne en ligne.</div>
      </Card>
    );
  }

  return (
    <Card className="p-2">
      <Header />
      <HoverBarList
        items={active}
        rowHeight={60}
        keyOf={(x) => x.p.id}
        onSelect={(x) => navigate(`/player/${x.p.id}`)}
        children={(x) => (
          <>
            <Avatar name={nameOf(x.p)} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{nameOf(x.p)}</div>
              <div className={cn("flex items-center gap-1 text-xs", x.s.text)}>
                {x.s.icon && <x.s.icon size={12} className="shrink-0" />}
                {x.s.label}
              </div>
            </div>
            <span className={cn("size-2.5 rounded-full", x.s.dot, x.s.pulse && "animate-pulse")} />
          </>
        )}
      />
    </Card>
  );
}
