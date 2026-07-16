import type { BadgeTier } from "@4eselo/types";
import { cn } from "../lib/cn";

/** Au-delà, on n'empile pas N émojis : on montre l'émoji + « ×N » (lisibilité). */
const MAX_REPEAT = 3;

/**
 * Badges à paliers (B5.14) - façon Calibrum. Chaque badge rend `count` émojis
 * (paliers) avec un tooltip = `message` (fourni par l'API, déjà fenêtré : 24h sur
 * le classement/home, 30j sur le profil). `max` limite le nombre de badges affichés
 * (le reste passe en « +N »). Le badge négatif `coldstreak` est teinté « loss ».
 * Rien si aucun badge.
 */
export function Badges({ tiers, max, className }: { tiers: BadgeTier[]; max?: number; className?: string }) {
  if (!tiers || tiers.length === 0) return null;
  const shown = max ? tiers.slice(0, max) : tiers;
  const extra = tiers.length - shown.length;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", className)}>
      {shown.map((t) => {
        const negative = t.id === "coldstreak";
        const repeat = Math.min(t.count, MAX_REPEAT);
        return (
          <span key={t.id} className="group/badge relative inline-flex leading-none">
            <span
              aria-label={t.message}
              className={cn(
                "inline-flex cursor-default items-center gap-0.5 text-[13px]",
                negative && "rounded bg-loss/12 px-1 py-0.5",
              )}
            >
              {Array.from({ length: repeat }, (_, i) => (
                <span key={i}>{t.emoji}</span>
              ))}
              {t.count > MAX_REPEAT && (
                <span className="ml-0.5 font-mono text-[10px] font-bold text-ink-faint">×{t.count}</span>
              )}
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-55 -translate-x-1/2 rounded-lg border border-white/10 bg-surface-2 px-2.5 py-1.5 text-left text-xs font-semibold text-ink opacity-0 shadow-xl transition-opacity duration-150 group-hover/badge:opacity-100"
            >
              {t.emoji} {t.message}
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
