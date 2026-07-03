import type { StatsRange } from "@4eselo/types";
import { cn } from "../lib/cn";

const OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "7d", label: "7j" },
  { value: "30d", label: "30j" },
  { value: "3m", label: "3m" },
  { value: "all", label: "Tout" },
];

/** Segmented control pour la fenêtre temporelle des stats. */
export function RangeTabs({ value, onChange }: { value: StatsRange; onChange: (r: StatsRange) => void }) {
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
              "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
              active ? "bg-brand text-[#060a18]" : "text-ink-dim hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
