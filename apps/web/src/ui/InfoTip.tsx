import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TbInfoCircle } from "react-icons/tb";
import { cn } from "../lib/cn";

const W = 240; // largeur max de la bulle
const M = 8; // marge écran

/**
 * Petite icône « i » avec une bulle d'explication au survol et au focus clavier.
 * La bulle est rendue en portal, en position fixed, et bornée au viewport → elle
 * ne sort jamais de l'écran (même sur mobile / près des bords).
 */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const half = Math.min(W, vw - M * 2) / 2;
    const x = Math.min(Math.max(r.left + r.width / 2, M + half), vw - M - half);
    setPos({ x, y: r.top });
  };
  const hide = () => setPos(null);

  return (
    <span className={cn("inline-flex", className)}>
      <button
        ref={ref}
        type="button"
        aria-label={text}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault();
          if (pos) hide();
          else show();
        }}
        className="grid size-4 cursor-help place-items-center rounded-full text-ink-faint transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <TbInfoCircle size={13} />
      </button>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y - M,
              transform: "translate(-50%, -100%)",
              maxWidth: `min(${W}px, calc(100vw - ${M * 2}px))`,
            }}
            className="pointer-events-none z-[100] w-max rounded-lg border border-white/10 bg-surface-2 px-2.5 py-1.5 text-left text-xs font-medium tracking-normal text-ink-dim normal-case shadow-xl"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
