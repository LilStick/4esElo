import { cn } from "../lib/cn";

/**
 * Fond décoratif : screenshot de map très estompé + dégradé vers le fond, pour
 * donner de la vie. À poser dans un parent `relative overflow-hidden`.
 */
export function MapBackdrop({ src, className }: { src: string; className?: string }) {
  return (
    <>
      <img
        src={src}
        alt=""
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 size-full object-cover opacity-[0.14]",
          className,
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/30 to-bg/90"
      />
    </>
  );
}
