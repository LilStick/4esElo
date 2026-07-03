import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { TbSearch } from "react-icons/tb";
import { useQuery } from "@tanstack/react-query";
import type { LeaderboardEntry } from "@4eselo/types";
import { getLeaderboard } from "../lib/api";
import { Avatar, LevelBadge } from "../ui";

const ROW = 52;
const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "—";
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["leaderboard", "faceit"],
    queryFn: () => getLeaderboard("faceit"),
    enabled: open,
  });
  const results = useMemo(() => {
    const players = data?.leaderboard ?? [];
    const n = norm(q.trim());
    const list = n ? players.filter((p) => norm(nameOf(p)).includes(n)) : players;
    return list.slice(0, 8);
  }, [q, data]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => setActive(0), [q]);

  // Barre qui glisse vers la ligne active (clavier + souris).
  const y = useMotionValue(0);
  useEffect(() => {
    if (reduce) {
      y.set(active * ROW);
      return;
    }
    const controls = animate(y, active * ROW, { type: "spring", stiffness: 500, damping: 40 });
    return () => controls.stop();
  }, [active, reduce, y]);

  const go = (p: LeaderboardEntry) => {
    onClose();
    navigate(`/player/${p.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = results[active];
      if (p) go(p);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Recherche de joueur"
            onKeyDown={onKeyDown}
            className="relative w-full max-w-lg overflow-hidden rounded-[18px] border border-white/[0.12] bg-surface-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
            initial={{ opacity: 0, y: reduce ? 0 : -8, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : -8, scale: reduce ? 1 : 0.98 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
              <TbSearch className="shrink-0 text-ink-faint" size={18} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un joueur…"
                className="w-full bg-transparent py-4 text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </div>

            <ul className="relative max-h-80 overflow-y-auto p-2">
              {results.length > 0 && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-2 top-2 rounded-[10px] bg-white/[0.07]"
                  style={{ y, height: ROW }}
                />
              )}
              {results.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(p)}
                    style={{ height: ROW }}
                    className="relative z-10 flex w-full items-center gap-3 rounded-[10px] px-3 text-left"
                  >
                    <Avatar name={nameOf(p)} size={30} />
                    <LevelBadge level={p.level} size={22} />
                    <span className="flex-1 truncate text-sm font-semibold">{nameOf(p)}</span>
                    <span className="font-mono text-sm font-bold text-brand tabular-nums">
                      {p.elo ?? "—"}
                    </span>
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-ink-dim">Aucun joueur trouvé.</li>
              )}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
