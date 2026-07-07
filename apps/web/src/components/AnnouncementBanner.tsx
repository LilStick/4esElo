import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { TbArrowRight, TbConfetti, TbSpeakerphone, TbX } from "react-icons/tb";
import type { Announcement } from "@4eselo/types";
import { getAnnouncements } from "../lib/api";

const DISMISS_KEY = "4eselo:dismissedAnnouncement";

const readDismissed = (): string | null => {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null; // localStorage indispo (mode privé strict) → on affiche, pas de crash
  }
};

/**
 * Bannière d'annonce sur la home (B15.9) : la plus récente annonce (Wrapped auto
 * ou staff). Dismissible et mémorisé en localStorage — fermée, elle ne revient
 * pas. Aucune annonce (ou déjà fermée) → aucun DOM.
 */
export function AnnouncementBanner() {
  const { data } = useQuery({ queryKey: ["announcements"], queryFn: () => getAnnouncements(1) });
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);

  const latest: Announcement | undefined = data?.announcements[0];
  if (!latest || dismissed === latest.id) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, latest.id);
    } catch {
      // pas de persistance possible → on ferme quand même pour la session courante
    }
    setDismissed(latest.id);
  };

  const Icon = latest.type === "wrapped" ? TbConfetti : TbSpeakerphone;
  const isInternal = latest.linkUrl?.startsWith("/") ?? false;

  const linkContent = (
    <>
      Voir
      <TbArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </>
  );
  const linkClass =
    "group inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex items-center gap-3 rounded-2xl border border-brand/25 bg-brand/[0.08] px-4 py-3"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{latest.title}</div>
        {latest.body && <div className="truncate text-xs text-ink-dim">{latest.body}</div>}
      </div>

      {latest.linkUrl &&
        (isInternal ? (
          <Link to={latest.linkUrl} className={linkClass}>
            {linkContent}
          </Link>
        ) : (
          <a href={latest.linkUrl} target="_blank" rel="noreferrer" className={linkClass}>
            {linkContent}
          </a>
        ))}

      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer l'annonce"
        className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <TbX size={16} />
      </button>
    </motion.div>
  );
}
