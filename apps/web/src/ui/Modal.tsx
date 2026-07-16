import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TbX } from "react-icons/tb";
import { cn } from "../lib/cn";

/**
 * Modale centrée en double-bezel (comme la Card) : coque en verre dépoli qui
 * enserre un cœur sombre, backdrop flou, fermeture Esc / clic dehors, corps
 * scrollable. Rayons concentriques (`cœur = coque - bezel`).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Coque du double-bezel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "relative flex max-h-[78vh] w-full flex-col border border-white/[0.09] bg-white/[0.045] shadow-[0_48px_120px_-30px_rgba(0,0,0,0.95)]",
              size === "lg" ? "max-w-2xl" : "max-w-md",
            )}
            style={{ borderRadius: "var(--r-card)", padding: "var(--bezel)" }}
            initial={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.97 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* Cœur */}
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-surface-2 to-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              style={{ borderRadius: "calc(var(--r-card) - var(--bezel))" }}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <span className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
                  {title}
                </span>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-dim transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  <TbX size={18} />
                </button>
              </div>
              <div className="min-h-0 overflow-y-auto p-2">{children}</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
