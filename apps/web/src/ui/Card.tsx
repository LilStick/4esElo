import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Classes sur la coque extérieure (position, translate, glow…). */
  outerClassName?: string;
};

/**
 * Carte double-bezel (Doppelrand) : une coque en verre dépoli qui enserre un
 * cœur plus sombre. Les rayons sont concentriques par construction —
 * `radius(cœur) = radius(coque) − bezel` — pour que les coins s'emboîtent.
 *
 * `className` stylise le cœur (padding, layout du contenu) ; `outerClassName`
 * agit sur la coque entière (ex. la soulever) pour ne pas désolidariser bezel
 * et contenu.
 */
export function Card({ className, outerClassName, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "border border-white/[0.09] bg-white/[0.045] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]",
        outerClassName,
      )}
      style={{ borderRadius: "var(--r-card)", padding: "var(--bezel)" }}
      {...props}
    >
      <div
        className={cn(
          "h-full bg-gradient-to-b from-surface-2 to-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
          className,
        )}
        style={{ borderRadius: "calc(var(--r-card) - var(--bezel))" }}
      >
        {children}
      </div>
    </div>
  );
}
