import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TbCrosshair, TbMenu2, TbTrophy, TbX } from "react-icons/tb";
import { cn } from "../lib/cn";

/** Entrées de navigation. La charte (/charte) n'y figure pas volontairement. */
const NAV = [{ to: "/", label: "Classement", icon: TbTrophy, end: true }];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
      <span className="grid size-8 place-items-center rounded-[9px] bg-gradient-to-br from-brand-hi to-brand-deep shadow-[0_6px_18px_-6px_rgba(94,139,255,0.5),inset_0_1px_0_rgba(255,255,255,0.4)]">
        <TbCrosshair className="size-[18px] text-white" />
      </span>
      <span className="text-[17px]">4esElo</span>
      <span className="text-sm font-medium text-ink-faint">· CS2</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
              isActive ? "bg-brand/12 text-ink" : "text-ink-dim hover:bg-white/[0.03] hover:text-ink",
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon size={18} className={isActive ? "text-brand" : undefined} />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

const FOOTER = <div className="px-3 text-xs text-ink-faint">Pôle CS2 · données Faceit</div>;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const off = reduce ? 0 : "-100%";

  return (
    <div className="min-h-full">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/[0.08] bg-white/[0.015] px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <div className="mt-8 flex-1">
          <NavList />
        </div>
        {FOOTER}
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.08] bg-bg/80 px-4 py-3 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="grid size-9 place-items-center rounded-lg text-ink-dim transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbMenu2 size={20} />
        </button>
        <Brand />
      </header>

      {/* Drawer mobile */}
      <AnimatePresence>
        {open && (
          <div className="lg:hidden">
            <motion.div
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.08] bg-bg px-4 py-6"
              initial={{ x: off }}
              animate={{ x: 0 }}
              exit={{ x: off }}
              transition={{ type: "tween", duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex items-center justify-between px-2">
                <Brand />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fermer le menu"
                  className="grid size-9 place-items-center rounded-lg text-ink-dim transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  <TbX size={20} />
                </button>
              </div>
              <div className="mt-8 flex-1">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
              {FOOTER}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Contenu */}
      <div className="lg:pl-60">
        <main className="mx-auto max-w-4xl px-4 py-8 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
