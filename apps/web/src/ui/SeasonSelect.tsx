import { useEffect, useRef, useState } from "react";
import { TbCalendar, TbCheck, TbChevronDown } from "react-icons/tb";
import type { Season } from "@4eselo/types";
import { cn } from "../lib/cn";

/**
 * Sélecteur de saison Faceit (B19.6). Vrai dropdown custom (bouton pilule + menu
 * stylé) — le `<select>` natif n'ouvrait pas au clic sur l'icône/chevron et n'avait
 * aucun style de menu. S'ouvre au clic n'importe où, ferme au clic-dehors + Échap.
 * Rendu par l'appelant uniquement s'il y a des saisons.
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = seasons.find((s) => s.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Saison"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.03] py-1 pr-2.5 pl-3 text-xs font-semibold text-ink-dim transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
      >
        <TbCalendar size={14} className="shrink-0 text-ink-faint" aria-hidden />
        <span className="text-ink">{current?.label ?? "Saison"}</span>
        <TbChevronDown
          size={14}
          aria-hidden
          className={cn("shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-1 min-w-40 rounded-xl border border-white/[0.1] bg-surface-2 p-1 shadow-xl"
        >
          {seasons.map((s) => {
            const active = s.id === value;
            return (
              <li key={s.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors",
                    active
                      ? "bg-brand/15 text-brand-hi"
                      : "text-ink-dim hover:bg-white/[0.05] hover:text-ink",
                  )}
                >
                  {s.label}
                  {active && <TbCheck size={14} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
