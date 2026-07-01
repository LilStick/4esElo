import l1 from "../assets/1.svg";
import l2 from "../assets/2.svg";
import l3 from "../assets/3.svg";
import l4 from "../assets/4.svg";
import l5 from "../assets/5.svg";
import l6 from "../assets/6.svg";
import l7 from "../assets/7.svg";
import l8 from "../assets/8.svg";
import l9 from "../assets/9.svg";
import l10 from "../assets/10.svg";

/** Icônes officielles Faceit, niveaux 1 à 10 (SVG avec leurs couleurs d'origine). */
const ICONS: Record<number, string> = { 1: l1, 2: l2, 3: l3, 4: l4, 5: l5, 6: l6, 7: l7, 8: l8, 9: l9, 10: l10 };

export function LevelBadge({ level, size = 28 }: { level: number | null; size?: number }) {
  const src = level != null ? ICONS[level] : undefined;
  if (!src) return <span className="text-xs text-ink-faint">—</span>;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={`Niveau Faceit ${level}`}
      title={`Niveau Faceit ${level}`}
      className="shrink-0 select-none"
      draggable={false}
    />
  );
}
