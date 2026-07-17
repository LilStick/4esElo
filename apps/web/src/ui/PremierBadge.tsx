import rawBg from "../assets/premiere-ranks/premier_rating_bg.svg?raw";
import { premierTier } from "../lib/premierTier";
import { cn } from "../lib/cn";

const fmt = (n: number) => n.toLocaleString("en-US"); // 33800 -> "33,800"

/**
 * Rang Premier (CS Rating) : le badge « drapeau » CS2 (asset SVG gris) dont on
 * teinte les chevrons `//` avec la couleur du palier, + le rating en texte
 * italique par-dessus (façon `.cs2rating` de csstats). Vectoriel, net à toute taille.
 * Remplace `LevelBadge` en mode Premier.
 */
export function PremierBadge({
  rating,
  height = 26,
  className,
}: {
  rating: number;
  /** Hauteur du badge en px (largeur dérivée du ratio 178:64). */
  height?: number;
  className?: string;
}) {
  const { color } = premierTier(rating);
  // Teinte les chevrons clairs de l'asset avec la couleur du palier.
  const svg = rawBg.replaceAll("#E6E6E6", color).replaceAll("#DEDEDE", color);
  const width = Math.round((height * 178) / 64);
  const s = fmt(rating);
  const [head, ...rest] = s.split(",");
  const tail = rest.length ? "," + rest.join(",") : "";

  return (
    <span
      className={cn("relative inline-block shrink-0 select-none", className)}
      style={{ width, height }}
      role="img"
      aria-label={`CS Rating ${s}`}
    >
      <span
        aria-hidden
        className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-end pr-[7%] font-mono font-extrabold tabular-nums italic"
        style={{ color, textShadow: "0 1px 0 #000", fontSize: Math.round(height * 0.5) }}
      >
        {head}
        {tail && <small style={{ fontSize: "0.7em", opacity: 0.75 }}>{tail}</small>}
      </span>
    </span>
  );
}
