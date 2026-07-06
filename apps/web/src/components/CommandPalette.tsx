import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Command } from "cmdk";
import { TbInfoCircle, TbLayoutDashboard, TbSearch, TbTrophy } from "react-icons/tb";
import type { IconType } from "react-icons";
import { useQuery } from "@tanstack/react-query";
import type { LeaderboardEntry } from "@4eselo/types";
import { getLeaderboard } from "../lib/api";
import { Avatar, LevelBadge } from "../ui";

const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "—";

const PAGES: { to: string; label: string; icon: IconType }[] = [
  { to: "/", label: "Accueil", icon: TbLayoutDashboard },
  { to: "/classement", label: "Classement", icon: TbTrophy },
  { to: "/asso", label: "L'asso", icon: TbInfoCircle },
];

const itemCls =
  "flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-ink";

/** Palette de commande (Ctrl/Cmd+K) sur cmdk : recherche joueurs + pages, style double-bezel. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const { data } = useQuery({
    queryKey: ["leaderboard", "faceit"],
    queryFn: () => getLeaderboard("faceit"),
    enabled: open,
  });
  const players = data?.leaderboard ?? [];

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Coque double-bezel */}
          <motion.div
            className="relative w-full max-w-lg border border-white/[0.09] bg-white/[0.045] shadow-[0_48px_120px_-30px_rgba(0,0,0,0.95)]"
            style={{ borderRadius: "var(--r-card)", padding: "var(--bezel)" }}
            initial={{ opacity: 0, y: reduce ? 0 : -10, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : -10, scale: reduce ? 1 : 0.98 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            <Command
              label="Recherche"
              loop
              onKeyDown={(e) => e.key === "Escape" && onClose()}
              className="overflow-hidden bg-gradient-to-b from-surface-2 to-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:text-ink-faint [&_[cmdk-group-heading]]:uppercase"
              style={{ borderRadius: "calc(var(--r-card) - var(--bezel))" }}
            >
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
                <TbSearch className="shrink-0 text-ink-faint" size={18} />
                <Command.Input
                  autoFocus
                  placeholder="Rechercher un joueur, une page…"
                  className="w-full bg-transparent py-4 text-sm text-ink outline-none placeholder:text-ink-faint"
                />
              </div>

              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-sm text-ink-dim">
                  Aucun résultat.
                </Command.Empty>

                <Command.Group heading="Pages">
                  {PAGES.map((p) => (
                    <Command.Item
                      key={p.to}
                      value={`page ${p.label}`}
                      onSelect={() => go(p.to)}
                      className={itemCls}
                    >
                      <span className="grid size-[30px] shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-ink-dim">
                        <p.icon size={16} />
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold">{p.label}</span>
                      <span className="text-[11px] tracking-wide text-ink-faint uppercase">Page</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                {players.length > 0 && (
                  <Command.Group heading="Joueurs">
                    {players.map((e) => (
                      <Command.Item
                        key={e.id}
                        value={`joueur ${nameOf(e)}`}
                        onSelect={() => go(`/player/${e.id}`)}
                        className={itemCls}
                      >
                        <Avatar name={nameOf(e)} size={30} />
                        <LevelBadge level={e.level} size={22} />
                        <span className="flex-1 truncate text-sm font-semibold">{nameOf(e)}</span>
                        <span className="font-mono text-sm font-bold text-brand tabular-nums">
                          {e.elo ?? "—"}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-ink-faint">
                {[
                  ["↑↓", "naviguer"],
                  ["↵", "ouvrir"],
                  ["esc", "fermer"],
                ].map(([k, label]) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <kbd className="rounded border border-white/[0.12] bg-white/[0.04] px-1.5 font-mono text-[10px]">
                      {k}
                    </kbd>
                    {label}
                  </span>
                ))}
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
