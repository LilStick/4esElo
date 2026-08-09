import { TbCalendar, TbChevronDown } from "react-icons/tb";
import type { Season } from "@4eselo/types";

/**
 * Sélecteur de saison Faceit (B19.4). `<select>` natif stylé (a11y + mobile +
 * passe à l'échelle quand les saisons s'accumulent), habillé façon pilule pour
 * rester cohérent avec `RangeTabs`. Rendu par l'appelant seulement s'il y a des saisons.
 */
export function SeasonSelect({
  seasons,
  value,
  onChange,
}: {
  seasons: Season[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.03] py-1 pr-8 pl-3 text-xs font-semibold text-ink-dim transition-colors focus-within:ring-2 focus-within:ring-brand/60 hover:text-ink">
      <TbCalendar size={14} className="shrink-0 text-ink-faint" aria-hidden />
      <select
        aria-label="Saison"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-semibold text-ink focus:outline-none"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id} className="bg-bg text-ink">
            {s.label}
          </option>
        ))}
      </select>
      <TbChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 text-ink-faint"
      />
    </label>
  );
}
