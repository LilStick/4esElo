import type { ButtonHTMLAttributes } from "react";
import type { IconType } from "react-icons";
import { cn } from "../lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  /** Icône Tabler affichée dans une pastille en fin de bouton. */
  icon?: IconType;
};

/**
 * Bouton. Le feedback qui compte est le press (`scale`), pas le hover - donc
 * le hover ne fait que changer la couleur, et l'icône nichée glisse légèrement.
 */
export function Button({ variant = "primary", icon: Icon, className, children, ...props }: Props) {
  return (
    <button
      className={cn(
        "group inline-flex cursor-pointer items-center gap-3 rounded-full text-sm font-semibold",
        "transition-[transform,background-color,border-color,color] duration-150 ease-[var(--ease-out)] active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        variant === "primary"
          ? "bg-brand py-[9px] pr-[9px] pl-[18px] text-[#060a18] shadow-[0_8px_24px_-10px_rgba(94,139,255,0.4),inset_0_1px_0_rgba(255,255,255,0.4)] hover:bg-brand-hi"
          : "border border-white/[0.16] bg-white/[0.045] px-[18px] py-[9px] text-ink hover:border-brand hover:text-brand-hi",
        className,
      )}
      {...props}
    >
      {children}
      {Icon && (
        <span className="grid size-[30px] place-items-center rounded-full bg-black/20 transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-[3px]">
          <Icon size={15} />
        </span>
      )}
    </button>
  );
}
