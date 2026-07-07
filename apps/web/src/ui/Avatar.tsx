import { useState } from "react";

/**
 * Avatar : photo si `src` fourni (repli initiales sur erreur/absence), sinon
 * initiale sur dégradé dérivé du pseudo (stable, sans image).
 */
export function Avatar({ name, size = 34, src }: { name: string; size?: number; src?: string | null }) {
  const [broken, setBroken] = useState(false);

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
        style={{ width: size, height: size }}
      />
    );
  }

  const letter = name.trim().charAt(0).toUpperCase() || "?";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  const from = `hsl(${hash} 62% 64%)`;
  const to = `hsl(${(hash + 32) % 360} 58% 44%)`;

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(140deg, ${from}, ${to})`,
      }}
    >
      {letter}
    </span>
  );
}
