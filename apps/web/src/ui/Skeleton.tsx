import type { CSSProperties } from "react";
import { cn } from "../lib/cn";

/** Bloc gris animé (pulse) pour les états de chargement. Coupe l'anim en reduced-motion. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/[0.06] motion-reduce:animate-none", className)}
      style={style}
    />
  );
}
