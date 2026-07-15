import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
  TbBulb,
  TbConfetti,
  TbGitCompare,
  TbInfoCircle,
  TbLayoutDashboard,
  TbLayoutSidebarFilled,
  TbLayoutSidebarRightFilled,
  TbMenu2,
  TbSearch,
  TbSparkles,
  TbTrophy,
  TbUsersGroup,
  TbX,
} from "react-icons/tb";
import { cn } from "../lib/cn";
import { currentPeriod } from "../lib/period";
import { CommandPalette } from "./CommandPalette";
import { Cheatsheet } from "./Cheatsheet";
import { AuthMenu } from "./AuthMenu";
import { AuthToast } from "./AuthToast";
import { Footer } from "./Footer";
import { Logo } from "../brand";

const SIDEBAR_KEY = "4eselo:sidebar-collapsed";
/** En dessous de cette largeur, la sidebar reste repliée (icônes) et le toggle
 *  disparaît : ça évite que la sidebar dépliée + son toggle chevauchent le
 *  contenu (rail gauche de la home) sur les écrans laptop. Ajustable. */
const EXPAND_MIN_PX = 1760;

/**
 * Déclencheur de la recherche globale (Ctrl/Cmd+K). Une seule structure pour
 * les deux états — l'icône reste dans un slot fixe (jamais de saut), seul le
 * libellé + le raccourci se rétractent en largeur/opacité au repli.
 */
function SearchTrigger({ onClick, collapsed }: { onClick: () => void; collapsed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Rechercher"
      title="Rechercher (⌘K)"
      className={cn(
        "flex h-10 items-center rounded-xl border border-white/[0.09] bg-white/[0.02] text-ink-dim transition-[width,color,border-color] duration-200 ease-out hover:border-white/[0.16] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        collapsed ? "w-10" : "w-full",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center">
        <TbSearch size={16} />
      </span>
      <span
        className={cn(
          "flex min-w-0 items-center gap-2 overflow-hidden pr-3 text-sm whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
          collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
        )}
      >
        <span className="flex-1 text-left">Rechercher</span>
        <kbd className="rounded border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
          ⌘K
        </kbd>
      </span>
    </button>
  );
}

/** Entrées de navigation. La charte (/charte) n'y figure pas volontairement. */
const NAV = [
  { to: "/", label: "Accueil", icon: TbLayoutDashboard, end: true },
  { to: "/classement", label: "Classement", icon: TbTrophy, end: false },
  { to: "/compare", label: "Comparer", icon: TbGitCompare, end: false },
  { to: "/social", label: "Social", icon: TbUsersGroup, end: false },
  { to: "/ideas", label: "Idées", icon: TbBulb, end: false },
  { to: "/asso", label: "L'asso", icon: TbInfoCircle, end: false },
  { to: `/wrapped/${currentPeriod()}`, label: "Wrapped", icon: TbConfetti, end: false },
  { to: "/changelog", label: "Nouveautés", icon: TbSparkles, end: false },
];

function Brand({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <Link to="/" aria-label="Retake - accueil" className="flex size-10 shrink-0 items-center">
        <Logo markOnly className="h-7 w-auto text-ink" />
      </Link>
    );
  }
  return (
    <Link to="/" className="flex h-10 items-center">
      <Logo title="Retake" className="h-8 w-auto text-ink" />
    </Link>
  );
}

/**
 * Bascule replier/déplier la sidebar (état persisté), posée en haut à gauche
 * du contenu — pas dans la sidebar elle-même. Icône nue, sans contour.
 * L'icône change selon l'état.
 */
function CollapseToggle({
  collapsed,
  onClick,
  className,
}: {
  collapsed: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
      title={collapsed ? "Déplier" : "Replier"}
      className={cn(
        "hidden size-9 shrink-0 place-items-center text-ink-dim transition-colors duration-150 ease-out hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 lg:grid",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={collapsed ? "collapsed" : "expanded"}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="grid place-items-center"
        >
          {collapsed ? <TbLayoutSidebarRightFilled size={20} /> : <TbLayoutSidebarFilled size={20} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

const NAV_ROW = 40; // hauteur d'un item (h-10)
const NAV_STEP = NAV_ROW + 4; // + gap-1

/** Nav vertical avec une barre unique qui glisse derrière l'item survolé, et
 *  revient sur l'item actif au repos — comme les listes du site. Replié :
 *  icônes seules + tooltip au survol (façon Taskk/Widelab). */
function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
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
        className="pointer-events-none absolute top-0 left-0 rounded-xl bg-brand/12 transition-[width] duration-200 ease-out"
        style={{ y, height: NAV_ROW, width: collapsed ? NAV_ROW : "100%" }}
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
              "group relative z-10 flex h-10 items-center rounded-xl text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
              isActive ? "text-ink" : "text-ink-dim hover:text-ink",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span className="grid size-10 shrink-0 place-items-center">
                <item.icon size={18} className={isActive ? "text-brand" : undefined} />
              </span>
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
                  collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
                )}
              >
                {item.label}
              </span>
              {collapsed && (
                <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg border border-white/[0.1] bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                  {item.label}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

const GOTO: Record<string, string> = { h: "/", c: "/classement", a: "/asso" };

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [help, setHelp] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "1");
  // Sous EXPAND_MIN_PX on force le repli (et on masque le toggle) → pas de chevauchement.
  const [canExpand, setCanExpand] = useState(
    () => typeof window === "undefined" || window.matchMedia(`(min-width: ${EXPAND_MIN_PX}px)`).matches,
  );
  const reduce = useReducedMotion();
  const navigate = useNavigate();

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${EXPAND_MIN_PX}px)`);
    const onChange = () => setCanExpand(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Repli effectif : préférence utilisateur si l'écran est assez large, sinon forcé.
  const effectiveCollapsed = canExpand ? collapsed : true;

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      return !c;
    });
  };
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

  // Cheatsheet des raccourcis : « ? » (hors champ de saisie)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      setHelp((h) => !h);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const off = reduce ? 0 : "-100%";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <AuthToast />
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col py-6 transition-[width] duration-200 ease-out lg:flex",
          "px-6",
          effectiveCollapsed ? "w-24" : "w-60",
        )}
      >
        <div className="flex h-10 items-center">
          <Brand collapsed={effectiveCollapsed} />
        </div>
        <div data-tour="search" className="mt-6">
          <SearchTrigger onClick={() => setSearch(true)} collapsed={effectiveCollapsed} />
        </div>
        <div data-tour="nav" className="mt-4 flex-1">
          <NavList collapsed={effectiveCollapsed} />
        </div>
        <div data-tour="auth" className="border-t border-white/[0.06] pt-3">
          <AuthMenu collapsed={effectiveCollapsed} />
        </div>
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
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-bg px-4 py-6"
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
              <div className="border-t border-white/[0.06] pt-3">
                <AuthMenu onNavigate={() => setOpen(false)} />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Contenu — la largeur max est portée par chaque page (évite le reflow pendant la transition).
          Le shell (sidebar + marge) reste fixe à l'écran ; seule la bulle défile en interne. */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-[padding-left] duration-200 ease-out",
          effectiveCollapsed ? "lg:pl-24" : "lg:pl-60",
        )}
      >
        <main className="flex w-full min-h-0 flex-1 flex-col px-4 py-6 lg:py-6 lg:pr-6 lg:pl-0">
          {/* La « bulle » (cadre arrondi + dégradé + décor) n'existe qu'à partir de lg.
              En mode menu burger (mobile), le contenu s'affiche à plat, pleine largeur. */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:rounded-[28px] lg:bg-gradient-to-b lg:from-surface lg:to-bg">
            {/* Décor — en dehors du conteneur qui défile, reste fixe avec le cadre. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -right-32 hidden size-96 rounded-full bg-brand/10 blur-3xl lg:block"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-40 -left-32 hidden size-80 rounded-full bg-brand/[0.06] blur-3xl lg:block"
            />
            {canExpand && (
              <CollapseToggle
                collapsed={collapsed}
                onClick={toggleCollapsed}
                className="absolute top-2 left-2 z-20 lg:top-3 lg:left-3"
              />
            )}
            <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-0 lg:p-8">
              <div className="flex flex-1 flex-col">{children}</div>
              <div className="mx-auto mt-6 w-full max-w-[1400px]">
                <Footer />
              </div>
            </div>
          </div>
        </main>
      </div>

      <CommandPalette open={search} onClose={() => setSearch(false)} />
      <Cheatsheet open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
