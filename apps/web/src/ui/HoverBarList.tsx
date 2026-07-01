import { animate, motion, useMotionValue } from "motion/react";
import { useState, type ReactNode } from "react";

type Props<T> = {
  items: T[];
  keyOf: (item: T, index: number) => string;
  children: (item: T, index: number) => ReactNode;
  onSelect?: (item: T, index: number) => void;
  /** Hauteur d'une ligne, en px. La barre s'aligne dessus. */
  rowHeight?: number;
};

/**
 * Liste avec une barre unique qui glisse derrière la ligne survolée (spring),
 * plutôt qu'un effet appliqué à chaque ligne. Reprend le mécanisme des projets
 * du portfolio d'Arthur : une seule surface animée en `y`, les lignes au-dessus.
 */
export function HoverBarList<T>({ items, keyOf, children, onSelect, rowHeight = 56 }: Props<T>) {
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
      {items.map((item, index) => (
        <li key={keyOf(item, index)}>
          <button
            type="button"
            onMouseEnter={() => enter(index)}
            onFocus={() => enter(index)}
            onClick={() => onSelect?.(item, index)}
            style={{ height: rowHeight }}
            className="relative z-10 flex w-full cursor-pointer items-center gap-4 rounded-[10px] px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            {children(item, index)}
          </button>
        </li>
      ))}
    </ul>
  );
}
