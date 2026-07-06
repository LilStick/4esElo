import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TbCheck, TbShare } from "react-icons/tb";
import { cn } from "../lib/cn";

/** Bouton « Partager » : copie l'URL courante dans le presse-papier + feedback « Lien copié ». */
export function ShareButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papier indisponible (contexte non sécurisé / permission refusée) : on n'affiche rien.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[13px] font-semibold transition-colors hover:border-white/[0.2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        copied ? "text-win" : "text-ink-dim hover:text-ink",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "copied" : "share"}
          className="inline-flex items-center gap-1.5"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {copied ? (
            <>
              <TbCheck size={15} /> Lien copié
            </>
          ) : (
            <>
              <TbShare size={15} /> Partager
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
