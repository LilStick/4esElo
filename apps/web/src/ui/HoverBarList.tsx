import { animate, motion, useMotionValue } from "motion/react";
import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

type Props<T> = {
  items: T[];
  keyOf: (item: T, index: number) => string;
  children: (item: T, index: number) => ReactNode;
  onSelect?: (item: T, index: number) => void;
  /** Si fourni, chaque ligne est un lien `<a href>` (sinon un `<button>`). */
  hrefOf?: (item: T, index: number) => string;
  /** Ouvre le lien dans un nouvel onglet (avec hrefOf). */
  external?: boolean;
  /** Hauteur d'une ligne, en px. La barre s'aligne dessus. */
  rowHeight?: number;
};

/**
 * Liste avec une barre unique qui glisse derrière la ligne survolée (spring),
 * plutôt qu'un effet appliqué à chaque ligne. Reprend le mécanisme des projets
 * du portfolio d'Arthur : une seule surface animée en `y`, les lignes au-dessus.
 */
export function HoverBarList<T>({
  items,
  keyOf,
  children,
  onSelect,
  hrefOf,
  external,
  rowHeight = 56,
}: Props<T>) {
  const [hovered, setHovered] = useState<number | null>(null);
  const y = useMotionValue(0);

  const enter = (index: number) => {
    const next = index * rowHeight;
    // Premier survol : on place la barre sans l'animer depuis 0.
    if (hovered === null) y.set(next);
    else animate(y, next, { type: "spring", stiffness: 420, damping: 38 });
    setHovered(index);
  };

  return (
    <ul className="relative" onMouseLeave={() => setHovered(null)}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 rounded-[10px] bg-white/[0.06]"
        style={{ y, height: rowHeight }}
        animate={{ opacity: hovered === null ? 0 : 1, scale: hovered === null ? 0.98 : 1 }}
        transition={{
          opacity: { duration: 0.18, ease: "easeOut" },
          scale: { duration: 0.22, ease: "easeOut" },
        }}
      />
      {items.map((item, index) => {
        const interactive = Boolean(hrefOf || onSelect);
        const rowClass = cn(
          "relative z-10 flex w-full items-center gap-4 rounded-[10px] px-4 text-left",
          interactive &&
            "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        );
        const style = { height: rowHeight };
        return (
          <li key={keyOf(item, index)} onMouseEnter={() => enter(index)}>
            {hrefOf ? (
              <a
                href={hrefOf(item, index)}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                onFocus={() => enter(index)}
                style={style}
                className={rowClass}
              >
                {children(item, index)}
              </a>
            ) : onSelect ? (
              <button
                type="button"
                onFocus={() => enter(index)}
                onClick={() => onSelect(item, index)}
                style={style}
                className={rowClass}
              >
                {children(item, index)}
              </button>
            ) : (
              <div style={style} className={rowClass}>
                {children(item, index)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
