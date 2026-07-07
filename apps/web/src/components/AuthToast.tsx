import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { TbAlertTriangle, TbBrandDiscord, TbCheck, TbX } from "react-icons/tb";
import { cn } from "../lib/cn";

type Kind = "ok" | "error" | "not-member";
const KINDS: Record<string, Kind> = { ok: "ok", error: "error", "not-member": "not-member" };

type Toast = { kind: Kind; invite: string | null };

/**
 * Retour du flow OAuth Discord (B17.3) : le back redirige vers `/?auth=…`. On
 * affiche un bandeau, on rafraîchit /me si connecté, puis on nettoie l'URL.
 */
export function AuthToast() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const raw = params.get("auth");
    const kind = raw ? KINDS[raw] : undefined;
    if (!kind) return;

    const invite = params.get("invite");
    setToast({ kind, invite });
    if (kind === "ok") void qc.invalidateQueries({ queryKey: ["me"] });

    // Nettoyage de l'URL (on retire auth/invite, on garde le reste).
    const next = new URLSearchParams(params);
    next.delete("auth");
    next.delete("invite");
    setParams(next, { replace: true });
  }, [params, qc, setParams]);

  // Auto-dismiss (sauf « pas membre » qui porte un lien d'invitation à cliquer).
  useEffect(() => {
    if (!toast || toast.kind === "not-member") return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const copy =
    toast?.kind === "ok"
      ? { icon: TbCheck, text: "Connecté ✓", tone: "win" as const }
      : toast?.kind === "not-member"
        ? {
            icon: TbBrandDiscord,
            text: "Tu n'es pas sur le Discord du pôle 4eSport.",
            tone: "brand" as const,
          }
        : { icon: TbAlertTriangle, text: "Connexion échouée, réessaie.", tone: "loss" as const };

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
        >
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md",
              copy.tone === "win" && "border-win/40 bg-win/12 text-win",
              copy.tone === "loss" && "border-loss/40 bg-loss/12 text-loss",
              copy.tone === "brand" && "border-brand/40 bg-brand/12 text-ink",
            )}
          >
            <copy.icon size={18} className="shrink-0" />
            <span>{copy.text}</span>
            {toast.kind === "not-member" && toast.invite && (
              <a
                href={toast.invite}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-[#060a18] transition-colors hover:bg-brand-hi"
              >
                Rejoindre
              </a>
            )}
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Fermer"
              className="ml-1 grid size-6 place-items-center rounded-md opacity-60 transition-opacity hover:opacity-100"
            >
              <TbX size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
