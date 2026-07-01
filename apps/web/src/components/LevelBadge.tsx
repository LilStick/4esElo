import { cn } from "../lib/cn";

/** Faceit skill level 1-10, colored roughly like the in-app badges. */
function levelClasses(level: number): string {
  if (level >= 10) return "bg-red-500/15 text-red-400 ring-red-500/30";
  if (level >= 8) return "bg-orange-500/15 text-orange-400 ring-orange-500/30";
  if (level >= 4) return "bg-yellow-500/15 text-yellow-400 ring-yellow-500/30";
  if (level >= 2) return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
  return "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30";
}

export function LevelBadge({ level }: { level: number | null }) {
  if (level == null) return <span className="text-xs text-zinc-600">—</span>;
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-sm font-bold ring-1",
        levelClasses(level),
      )}
      title={`Niveau Faceit ${level}`}
    >
      {level}
    </span>
  );
}
