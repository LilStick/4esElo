/** Mini-courbe d'ELO (SVG), colorée selon la pente. Rien si moins de 2 points. */
export function Sparkline({
  points,
  width = 68,
  height = 22,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const pad = 2; // marge verticale pour que le trait ne soit pas collé aux bords
  const y = (p: number) => height - pad - ((p - min) / range) * (height - pad * 2);
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${y(p).toFixed(1)}`);
  const line = coords.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  const up = points[points.length - 1]! >= points[0]!;
  const stroke = up ? "var(--color-win)" : "var(--color-loss)";
  const id = `spark-${up ? "up" : "down"}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
}
