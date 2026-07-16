import { TbChevronLeft, TbChevronRight } from "react-icons/tb";
import { cn } from "../lib/cn";
import { clampPage, pageWindow } from "../lib/pagination";

/**
 * Pagination numérotée (préc / 1 2 … N / suiv). `page` est 0-based. Ne s'affiche
 * pas s'il n'y a qu'une page. Utilisable au clavier (vrais boutons).
 */
export function Pagination({
  page,
  pageCount,
  onPage,
  className,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const cur = clampPage(page, pageCount);
  const go = (p: number) => onPage(clampPage(p, pageCount));

  const btn =
    "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-40 disabled:pointer-events-none";

  return (
    <nav className={cn("flex items-center justify-center gap-1", className)} aria-label="Pagination">
      <button
        type="button"
        onClick={() => go(cur - 1)}
        disabled={cur === 0}
        aria-label="Page précédente"
        className={cn(btn, "text-ink-dim hover:bg-white/[0.06] hover:text-ink")}
      >
        <TbChevronLeft size={17} />
      </button>
      {pageWindow(cur, pageCount).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="grid h-9 w-6 place-items-center text-ink-faint">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p - 1)}
            aria-current={p - 1 === cur ? "page" : undefined}
            className={cn(
              btn,
              p - 1 === cur
                ? "bg-brand/15 text-brand-hi"
                : "text-ink-dim hover:bg-white/[0.06] hover:text-ink",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => go(cur + 1)}
        disabled={cur === pageCount - 1}
        aria-label="Page suivante"
        className={cn(btn, "text-ink-dim hover:bg-white/[0.06] hover:text-ink")}
      >
        <TbChevronRight size={17} />
      </button>
    </nav>
  );
}
