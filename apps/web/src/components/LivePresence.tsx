import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { IconType } from "react-icons";
import { TbArrowsDiagonal, TbDeviceGamepad2, TbSwords } from "react-icons/tb";
import type { PresenceEntry } from "@4eselo/types";
import { getPresence } from "../lib/api";
import { Avatar, Card, Modal, Skeleton } from "../ui";
import { cn } from "../lib/cn";

const nameOf = (p: PresenceEntry) => p.faceitNickname ?? p.discordName ?? "—";

type Status = { rank: number; label: string; text: string; dot: string; pulse: boolean; icon?: IconType };

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

function PresenceRow({ p, s }: { p: PresenceEntry; s: Status }) {
  return (
    <Link
      to={`/player/${p.id}`}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.03]"
    >
      <Avatar name={nameOf(p)} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold transition-colors group-hover:text-brand-hi">{nameOf(p)}</div>
        <div className={cn("flex items-center gap-1 text-xs", s.text)}>
          {s.icon && <s.icon size={12} className="shrink-0" />}
          {s.label}
        </div>
      </div>
      <span className={cn("size-2.5 rounded-full", s.dot, s.pulse && "animate-pulse")} />
    </Link>
  );
}

/** Widget « En jeu maintenant » : un membre actif en vedette, le reste dans une modale. Rafraîchi 60 s. */
export function LivePresence() {
  const { data, isLoading } = useQuery({
    queryKey: ["presence"],
    queryFn: getPresence,
    refetchInterval: 60_000,
  });
  const [open, setOpen] = useState(false);

  const active = (data?.players ?? [])
    .map((p) => ({ p, s: statusOf(p) }))
    .filter((x): x is { p: PresenceEntry; s: Status } => x.s !== null)
    .sort((a, b) => a.s.rank - b.s.rank);
  const top = active[0];

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
          <TbDeviceGamepad2 size={14} className="shrink-0 text-brand" />
          <span className="truncate">En jeu maintenant</span>
        </div>
        {active.length > 1 && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Voir tout"
            title={`Voir tout (${active.length})`}
            className="flex shrink-0 cursor-pointer items-center gap-1 font-mono text-[11px] font-bold text-ink-dim tabular-nums transition-colors hover:text-brand-hi"
          >
            {active.length}
            <TbArrowsDiagonal size={13} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        </div>
      ) : top ? (
        <PresenceRow p={top.p} s={top.s} />
      ) : (
        <div className="py-2 text-sm text-ink-dim">Personne en ligne.</div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="En ligne">
        {active.map(({ p, s }) => (
          <PresenceRow key={p.id} p={p} s={s} />
        ))}
      </Modal>
    </Card>
  );
}
