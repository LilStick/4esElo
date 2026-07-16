import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  TbBrandDiscord,
  TbConfetti,
  TbLogout,
  TbSelector,
  TbShieldCog,
  TbUser,
  TbUserPlus,
} from "react-icons/tb";
import { Avatar } from "../ui";
import { loginUrl, logout } from "../lib/api";
import { useMe } from "../lib/useMe";
import { currentPeriod } from "../lib/period";
import { cn } from "../lib/cn";

/** Ligne d'action du popover (icône + libellé, façon menu). */
function MenuAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof TbUser;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-dim transition-colors hover:bg-white/[0.06] hover:text-ink"
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

/**
 * Bloc de session dans la sidebar (B17.3). Trois états : anonyme (bouton login
 * Discord), connecté sans fiche (inviter à finir l'inscription), connecté membre.
 *
 * Membre (B14.17) : même interaction déplié/replié - un clic sur l'avatar
 * (+ nom si déplié) ouvre un popover à droite avec profil / Wrapped / admin /
 * déconnexion (façon Widelab), plutôt qu'un bandeau d'icônes toujours ouvert.
 */
export function AuthMenu({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { isLoading, isAuthenticated, player, displayName, isAdmin, avatarUrl } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const go = (to: string) => {
    setMenuOpen(false);
    onNavigate?.();
    navigate(to);
  };

  const onLogout = async () => {
    setMenuOpen(false);
    try {
      await logout();
    } finally {
      // succès ou non, on repart d'un état propre côté client
      await qc.invalidateQueries({ queryKey: ["me"] });
      onNavigate?.();
      navigate("/");
    }
  };

  if (isLoading) {
    return (
      <div className={cn("h-10 animate-pulse rounded-xl bg-white/[0.04]", collapsed ? "w-10" : "w-full")} />
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => (window.location.href = loginUrl())}
        className={cn(
          "flex h-10 items-center rounded-xl border border-white/[0.12] bg-white/[0.04] text-sm font-semibold text-ink transition-[width,color,border-color] duration-200 ease-out hover:border-brand hover:text-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
          collapsed ? "w-10" : "w-full",
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center">
          <TbBrandDiscord size={18} />
        </span>
        <span
          className={cn(
            "overflow-hidden pr-3 whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
            collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
          )}
        >
          Se connecter
        </span>
      </button>
    );
  }

  const name = displayName ?? "Moi";

  // Connecté mais pas encore de fiche joueur → finir l'inscription.
  if (!player) {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 transition-[width] duration-200 ease-out",
          collapsed ? "w-10" : "w-full",
        )}
      >
        <div className="flex h-10 items-center">
          <span className="grid size-10 shrink-0 place-items-center">
            <Avatar name={name} size={26} src={avatarUrl} />
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 overflow-hidden truncate pr-1 text-sm font-semibold whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
              collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
            )}
          >
            {name}
          </span>
        </div>
        <button
          type="button"
          onClick={() => go("/register")}
          aria-label="Finir l'inscription"
          title="Finir l'inscription"
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-brand text-xs font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbUserPlus size={15} className="shrink-0" />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
              collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
            )}
          >
            Finir l'inscription
          </span>
        </button>
      </div>
    );
  }

  // Connecté + membre : avatar (+ nom si déplié), clic ouvre le popover à droite.
  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="Menu du compte"
        aria-expanded={menuOpen}
        className={cn(
          "flex h-10 items-center rounded-xl transition-[width,background-color] duration-200 ease-out hover:bg-white/[0.05] active:scale-[0.97]",
          collapsed ? "w-10" : "w-full",
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center">
          <Avatar name={name} size={26} src={avatarUrl} />
        </span>
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
            collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
          {isAdmin && (
            <span className="shrink-0 rounded bg-brand/15 px-1 py-0.5 text-[9px] font-bold tracking-wider text-brand-hi uppercase">
              admin
            </span>
          )}
          <TbSelector size={15} className="shrink-0 text-ink-faint" />
        </span>
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1, ease: "easeOut" } }}
            className="absolute bottom-0 left-full z-50 ml-3 w-56 origin-bottom-left rounded-xl border border-white/[0.1] bg-surface-2 p-1.5 shadow-2xl"
          >
            <div className="flex items-center gap-2 px-2.5 py-2">
              <Avatar name={name} size={28} src={avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{name}</div>
                {isAdmin && (
                  <div className="text-[10px] font-bold tracking-wider text-brand-hi uppercase">Admin</div>
                )}
              </div>
            </div>
            <div className="my-1 border-t border-white/[0.06]" />
            <MenuAction label="Mon profil" icon={TbUser} onClick={() => go(`/player/${player.id}`)} />
            <MenuAction
              label="Mon Wrapped"
              icon={TbConfetti}
              onClick={() => go(`/wrapped/${currentPeriod()}/${player.id}`)}
            />
            {isAdmin && <MenuAction label="Panel admin" icon={TbShieldCog} onClick={() => go("/admin")} />}
            <MenuAction label="Se déconnecter" icon={TbLogout} onClick={onLogout} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
