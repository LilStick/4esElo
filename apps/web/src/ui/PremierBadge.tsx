import { premierTier } from "../lib/premierTier";
import { cn } from "../lib/cn";
import steel from "../assets/premiere-ranks/premier_rank_steel.svg";
import sky from "../assets/premiere-ranks/premier_rank_sky.svg";
import blue from "../assets/premiere-ranks/premier_rank_blue.svg";
import purple from "../assets/premiere-ranks/premier_rank_purple.svg";
import pink from "../assets/premiere-ranks/premier_rank_pink.svg";
import red from "../assets/premiere-ranks/premier_rank_red.svg";
import gold from "../assets/premiere-ranks/premier_rank_gold.svg";

/** Un SVG pré-coloré par palier (image) → pas de teinte runtime ni de collision d'IDs. */
const SRC: Record<string, string> = { steel, sky, blue, purple, pink, red, gold };

const fmt = (n: number) => n.toLocaleString("en-US"); // 33800 -> "33,800"

/**
 * Rang Premier (CS Rating) façon CS2 : badge « drapeau » coloré du palier
 * (asset SVG dédié) + le rating en blanc italique par-dessus.
 */
export function PremierBadge({
  rating,
  height = 28,
  className,
}: {
  rating: number;
  /** Hauteur du badge en px (largeur dérivée du ratio 178:64). */
  height?: number;
  className?: string;
}) {
  const t = premierTier(rating);
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
      <img src={SRC[t.name] ?? steel} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center pl-[14%] font-extrabold tabular-nums text-white italic"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)", fontSize: Math.round(height * 0.5) }}
      >
        {head}
        {tail && <small style={{ fontSize: "0.72em", opacity: 0.85 }}>{tail}</small>}
      </span>
    </span>
  );
}
