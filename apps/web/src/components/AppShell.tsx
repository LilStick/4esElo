import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { TbInfoCircle, TbLayoutDashboard, TbMenu2, TbSearch, TbTrophy, TbX } from "react-icons/tb";
import { cn } from "../lib/cn";
import { CommandPalette } from "./CommandPalette";
import lockup from "../assets/logo/4esElo_lockup_transparent.png";

/** Déclencheur de la recherche globale (Ctrl/Cmd+K). */
function SearchTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.02] px-3 py-2 text-sm text-ink-dim transition-colors hover:border-white/[0.16] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        className,
      )}
    >
      <TbSearch size={16} />
      <span className="flex-1 text-left">Rechercher</span>
      <kbd className="rounded border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
        ⌘K
      </kbd>
    </button>
  );
}

/** Entrées de navigation. La charte (/charte) n'y figure pas volontairement. */
const NAV = [
  { to: "/", label: "Accueil", icon: TbLayoutDashboard, end: true },
  { to: "/classement", label: "Classement", icon: TbTrophy, end: false },
  { to: "/asso", label: "L'asso", icon: TbInfoCircle, end: false },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center">
      <img src={lockup} alt="4esElo" className="h-9 w-auto invert" />
    </Link>
  );
}

const NAV_ROW = 40; // hauteur d'un item (h-10)
const NAV_STEP = NAV_ROW + 4; // + gap-1

/** Nav vertical avec une barre unique qui glisse derrière l'item survolé, et
 *  revient sur l'item actif au repos — comme les listes du site. */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);

  const activeIndex = NAV.findIndex((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  const barIndex = hovered ?? (activeIndex >= 0 ? activeIndex : 0);
  const barVisible = hovered !== null || activeIndex >= 0;

  const y = useMotionValue(barIndex * NAV_STEP);
  useEffect(() => {
    const target = barIndex * NAV_STEP;
    if (reduce) {
      y.set(target);
      return;
    }
    const controls = animate(y, target, { type: "spring", stiffness: 420, damping: 38 });
    return () => controls.stop();
  }, [barIndex, reduce, y]);

  return (
    <nav className="relative flex flex-col gap-1" onMouseLeave={() => setHovered(null)}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-brand/12"
        style={{ y, height: NAV_ROW }}
        animate={{ opacity: barVisible ? 1 : 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      />
      {NAV.map((item, i) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          onMouseEnter={() => setHovered(i)}
          className={({ isActive }) =>
            cn(
              "relative z-10 flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
              isActive ? "text-ink" : "text-ink-dim hover:text-ink",
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

const GOTO: Record<string, string> = { h: "/", c: "/classement", a: "/asso" };

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Home (landing) et profil adoptent une mise en page large ; les autres pages restent compactes.
  const wide = pathname === "/" || pathname.startsWith("/player/");

  // Raccourcis « G maintenu + h/c/a » pour naviguer (inactif quand on tape dans un champ).
  useEffect(() => {
    let gHeld = false;
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping()) return;
      const k = e.key.toLowerCase();
      if (k === "g") {
        gHeld = true;
        return;
      }
      if (gHeld && GOTO[k]) {
        e.preventDefault();
        navigate(GOTO[k]);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "g") gHeld = false;
    };
    const reset = () => (gHeld = false);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", reset);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", reset);
    };
  }, [navigate]);

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

  // Recherche globale : Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const off = reduce ? 0 : "-100%";

  return (
    <div className="min-h-full">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/[0.08] bg-white/[0.015] px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <SearchTrigger onClick={() => setSearch(true)} className="mt-6 w-full" />
        <div className="mt-4 flex-1">
          <NavList />
        </div>
        {FOOTER}
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.08] bg-bg/80 px-4 py-3 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="grid size-10 place-items-center rounded-lg text-ink-dim transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbMenu2 size={20} />
        </button>
        <Brand />
        <button
          onClick={() => setSearch(true)}
          aria-label="Rechercher"
          className="ml-auto grid size-10 place-items-center rounded-lg text-ink-dim transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbSearch size={19} />
        </button>
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
                  className="grid size-10 place-items-center rounded-lg text-ink-dim transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
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
        <main className={cn("mx-auto px-4 py-8 lg:px-8 lg:py-10", wide ? "max-w-[1560px]" : "max-w-4xl")}>
          {children}
        </main>
      </div>

      <CommandPalette open={search} onClose={() => setSearch(false)} />
    </div>
  );
}
