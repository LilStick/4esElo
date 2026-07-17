import { motion, useReducedMotion } from "motion/react";
import type { EloSource } from "@4eselo/types";
import { cn } from "../lib/cn";

const OPTIONS: { value: EloSource; label: string }[] = [
  { value: "faceit", label: "Faceit" },
  { value: "premier", label: "Premier" },
];

/**
 * Sélecteur de source ELO (Faceit / Premier) - segmented control, pastille qui
 * glisse (façon RangeTabs). N'a de sens que si Premier est activé : masquer via
 * `usePremierEnabled()` côté appelant.
 */
export function SourceToggle({
  value,
  onChange,
  className,
}: {
  value: EloSource;
  onChange: (s: EloSource) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn(
        "inline-flex gap-1 rounded-full border border-white/[0.09] bg-white/[0.03] p-1",
        className,
      )}
      role="tablist"
      aria-label="Source du classement"
    >
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
              active ? "text-[#060a18]" : "text-ink-dim hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                aria-hidden
                layoutId="source-pill"
                className="absolute inset-0 rounded-full bg-brand"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
