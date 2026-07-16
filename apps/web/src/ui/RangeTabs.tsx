import { motion, useReducedMotion } from "motion/react";
import type { StatsRange } from "@4eselo/types";
import { cn } from "../lib/cn";

const OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "7d", label: "7j" },
  { value: "30d", label: "30j" },
  { value: "3m", label: "3m" },
  { value: "all", label: "Tout" },
];

/** Segmented control pour la fenêtre temporelle des stats - pastille active qui glisse. */
export function RangeTabs({ value, onChange }: { value: StatsRange; onChange: (r: StatsRange) => void }) {
  const reduce = useReducedMotion();
  return (
    <div
      className="inline-flex gap-1 rounded-full border border-white/[0.09] bg-white/[0.03] p-1"
      role="tablist"
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
              "relative cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
              active ? "text-[#060a18]" : "text-ink-dim hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                aria-hidden
                layoutId="range-pill"
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
