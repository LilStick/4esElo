import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "../ui";
import { useTitle } from "../lib/useTitle";
import bash from "../assets/stickers/Bash_Holo.webp";
import bish from "../assets/stickers/Bish_Holo.webp";
import zywoo from "../assets/stickers/BLAST_23_sig_zywoo_gold_large.webp";
import vita from "../assets/stickers/BLAST_23_vita_holo.webp";
import bosh from "../assets/stickers/Bosh_Holo.webp";
import crown from "../assets/stickers/Crown_Foil.webp";
import titan from "../assets/stickers/Sticker-katowice-2014-titan-holo.webp";
import vox from "../assets/stickers/Sticker-katowice-2014-vox-holo.webp";

const S = [bash, bish, zywoo, vita, bosh, crown, titan, vox];

// 4 stickers, un par coin, jitter aléatoire dans la zone → placement random
// mais jamais par-dessus le 404 central. top/left en %.
const ZONES = [
  { top: [3, 15], left: [4, 18] },
  { top: [4, 16], left: [64, 80] },
  { top: [62, 78], left: [5, 20] },
  { top: [60, 76], left: [63, 79] },
] as const;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Tire 4 stickers distincts, placés aléatoirement (un par coin), gros. */
function pickStickers() {
  const idx = [...S.keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return ZONES.map((z, i) => ({
    src: S[idx[i]!],
    top: rand(z.top[0], z.top[1]),
    left: rand(z.left[0], z.left[1]),
    rot: rand(-15, 15),
    size: rand(190, 260),
  }));
}

export function NotFound() {
  useTitle("Page introuvable");
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [stickers] = useState(pickStickers);

  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden text-center">
      {/* Stickers CS collés sur la page (grosse ombre portée + pop de pose) */}
      {stickers.map((p, i) => (
        <motion.img
          key={i}
          src={p.src}
          alt=""
          aria-hidden
          className="pointer-events-none absolute max-w-[38vw] drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
          style={{ top: `${p.top}%`, left: `${p.left}%`, width: p.size }}
          initial={reduce ? false : { opacity: 0, scale: 1.6, rotate: p.rot - 8 }}
          animate={reduce ? { opacity: 1, rotate: p.rot } : { opacity: 1, scale: 1, rotate: p.rot }}
          transition={
            reduce ? undefined : { delay: 0.15 + i * 0.12, type: "spring", stiffness: 240, damping: 15 }
          }
        />
      ))}

      {/* Centre */}
      <div className="relative z-10 flex flex-col items-center gap-4 px-4">
        <div className="bg-gradient-to-br from-brand-hi via-brand to-brand-deep bg-clip-text font-mono text-[140px] leading-none font-black tracking-tighter text-transparent drop-shadow-[0_0_48px_rgba(94,139,255,0.4)] sm:text-[220px]">
          404
        </div>
        <h1 className="text-xl font-bold">Page introuvable</h1>
        <p className="max-w-sm text-sm text-ink-dim">
          Cette page n'existe pas (ou plus) — comme un smoke qui part dans le vide.
        </p>
        <Button onClick={() => navigate("/")}>Retour à l'accueil</Button>
      </div>
    </div>
  );
}
