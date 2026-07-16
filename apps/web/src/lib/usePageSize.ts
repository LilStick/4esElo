import { useEffect, useState } from "react";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Nombre d'éléments par page calculé selon la hauteur de l'écran (recalculé au
 * resize). `reserved` = place prise autour de la liste (header, marges, pagination).
 * Plus l'écran est grand, plus on montre d'éléments par page.
 */
export function usePageSize({
  rowHeight,
  reserved = 380,
  min = 6,
  max = 60,
}: {
  rowHeight: number;
  reserved?: number;
  min?: number;
  max?: number;
}) {
  const compute = () => {
    if (typeof window === "undefined") return min;
    return clamp(Math.floor((window.innerHeight - reserved) / rowHeight), min, max);
  };
  const [size, setSize] = useState(compute);
  useEffect(() => {
    const onResize = () => setSize(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeight, reserved, min, max]);
  return size;
}
