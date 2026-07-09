import { BADGE_CATALOG, type BadgeId } from "@4eselo/types";
import { cn } from "../lib/cn";

/**
 * Badges emoji (B5.9) — mini-icônes de perf récente à côté du pseudo, avec un
 * tooltip au survol (emoji + libellé + comment on le gagne). `max` limite
 * l'affichage sur le classement (le reste passe en « +N »). Rien si aucun badge.
 */
export function Badges({ ids, max, className }: { ids: BadgeId[]; max?: number; className?: string }) {
  if (!ids || ids.length === 0) return null;
  const shown = max ? ids.slice(0, max) : ids;
  const extra = ids.length - shown.length;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {shown.map((id) => {
        const b = BADGE_CATALOG[id];
        return (
          <span key={id} className="group/badge relative inline-flex leading-none">
            <span aria-label={b.label} className="cursor-default text-[13px]">
              {b.emoji}
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-white/[0.1] bg-surface-2 px-2.5 py-1.5 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover/badge:opacity-100"
            >
              <span className="block text-xs font-bold text-ink">
                {b.emoji} {b.label}
              </span>
              <span className="mt-0.5 block text-[11px] text-ink-dim">{b.description}</span>
            </span>
          </span>
        );
      })}
      {extra > 0 && (
        <span
          className="text-[10px] font-bold text-ink-faint"
          title={`+${extra} autre${extra > 1 ? "s" : ""}`}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
