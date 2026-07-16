import { TbInfoCircle } from "react-icons/tb";
import { cn } from "../lib/cn";

/**
 * Petite icône « i » avec une bulle d'explication au survol et au focus clavier.
 * Sert à préciser ce que dit une stat (ex. « ADR », « Entrées gagnées »).
 * Accessible : bouton focusable, `aria-label` = le texte, bulle `role="tooltip"`.
 */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("group/info relative inline-flex", className)}>
      <button
        type="button"
        aria-label={text}
        className="grid size-4 cursor-help place-items-center rounded-full text-ink-faint transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <TbInfoCircle size={13} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-white/10 bg-surface-2 px-2.5 py-1.5 text-left text-xs font-medium tracking-normal text-ink-dim normal-case opacity-0 shadow-xl transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
