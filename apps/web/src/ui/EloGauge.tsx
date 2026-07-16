import { useEffect, useState, type CSSProperties } from "react";

type Props = {
  elo: number;
  /** Position dans le palier de niveau, 0-100. */
  pct: number;
  size?: number;
};

/**
 * Jauge d'ELO radiale. L'anneau se remplit une fois au montage (ease-out) :
 * l'ELO est ce qui compte, donc c'est ce qui brille.
 */
export function EloGauge({ elo, pct, size = 152 }: Props) {
  const [p, setP] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setP(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="gauge-ring size-full" style={{ "--p": `${p}%` } as CSSProperties} />
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="font-mono text-[32px] font-extrabold tracking-tight tabular-nums">{elo}</div>
        <div className="mt-[3px] text-[10px] tracking-[0.18em] text-ink-faint uppercase">ELO</div>
      </div>
    </div>
  );
}
