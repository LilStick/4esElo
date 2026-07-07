import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TbArrowLeft, TbArrowRight, TbX } from "react-icons/tb";
import { TOUR_KEY, TOUR_REPLAY_EVENT } from "../lib/tour";

type Step = {
  /** Route à afficher pour cette étape (navigue avant de cibler). */
  path?: string;
  /** Sélecteur de l'élément à mettre en lumière (spotlight). Absent = bulle centrée. */
  target?: string;
  title: string;
  body: string;
};

/** Le parcours guidé : navigue entre les pages et éclaire les vrais éléments. */
const STEPS: Step[] = [
  {
    path: "/",
    target: '[data-tour="nav"]',
    title: "La navigation",
    body: "Accueil, Classement, Comparer, Social, Wrapped… tout est ici, à gauche.",
  },
  {
    path: "/",
    target: '[data-tour="search"]',
    title: "Recherche rapide",
    body: "Trouve un membre en un éclair — ou appuie sur ⌘/Ctrl + K de n'importe où.",
  },
  {
    path: "/classement",
    target: '[data-tour="ladder"]',
    title: "Le classement",
    body: "Le cœur du site : classé par ELO Faceit et paliers. Clique une ligne pour ouvrir un profil détaillé (courbe d'ELO, stats, maps, duos).",
  },
  {
    path: "/",
    target: '[data-tour="auth"]',
    title: "Ton compte",
    body: "Connecte-toi avec Discord et renseigne ton pseudo Faceit pour apparaître au classement.",
  },
  {
    title: "Tu es prêt 🎯",
    body: "Explore, compare, grimpe. Astuce : la touche « ? » affiche tous les raccourcis clavier à tout moment.",
  },
];

const seen = (): boolean => {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true;
  }
};

const TW = 340; // largeur bulle

/**
 * Onboarding première visite (B14.6) — tour guidé « façon jeu vidéo » : spotlight
 * sur les vrais éléments, bulle explicative, navigation automatique entre les
 * pages, progression. Une seule fois (localStorage). Skippable, Échap ferme,
 * respecte prefers-reduced-motion.
 */
export function Tour() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(() => !seen());
  const [index, setIndex] = useState(0);
  // Index réellement affiché : il ne rattrape `index` qu'une fois la nouvelle cible
  // localisée → pendant la navigation la bulle garde le contenu + la position de
  // l'étape précédente (pas de « contenu classement plaqué sur recherche rapide »).
  const [shownIndex, setShownIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // "spot" = spotlight sur une cible ; "center" = bulle centrée (voile plein).
  // On garde le dernier rect pendant les transitions → le spotlight voyage au lieu de popper.
  const [mode, setMode] = useState<"spot" | "center">("center");
  const elRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [tipH, setTipH] = useState(190);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // pas de persistance possible → on ferme au moins pour la session
    }
    setActive(false);
  }, []);

  const step = STEPS[index]!;
  const shown = STEPS[shownIndex]!;
  const isLast = shownIndex === STEPS.length - 1;

  // Localise la cible de l'étape (navigue d'abord si besoin), en suivant les
  // éléments qui apparaissent après le changement de route.
  useEffect(() => {
    if (!active) return;
    if (step.path && location.pathname !== step.path) {
      navigate(step.path);
      // On garde le rect/mode courant : le spotlight reste sur l'ancienne cible
      // pendant la navigation, puis voyagera vers la nouvelle une fois localisée.
      return; // l'effet se relance au changement de pathname
    }
    if (!step.target) {
      setMode("center"); // étape volontairement centrée (ex. écran final)
      setShownIndex(index);
      return;
    }
    let raf = 0;
    let tries = 0;
    let scrolled = false;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(step.target!);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        elRef.current = el;
        if (!scrolled) {
          el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          scrolled = true;
        }
        setRect(el.getBoundingClientRect());
        setMode("spot");
        setShownIndex(index); // cible prête → on bascule contenu + position ensemble
        raf = requestAnimationFrame(tick); // colle le spotlight pendant le scroll
      } else if (tries++ < 90) {
        raf = requestAnimationFrame(tick);
      } else {
        setMode("center"); // introuvable (ex. mobile, sidebar cachée) → bulle centrée
        setShownIndex(index);
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, index, step.path, step.target, location.pathname, navigate, reduce]);

  // Mesure la hauteur réelle de la bulle → placement sans débordement.
  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight);
  }, [shownIndex, rect, active]);

  // Replay depuis l'extérieur (bouton « Revoir le tuto »).
  useEffect(() => {
    const onReplay = () => {
      setIndex(0);
      setActive(true);
    };
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, []);

  // Échap ferme + verrou du scroll.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active, finish]);

  if (!active) return null;

  const pad = 8;
  const M = 14; // marge écran
  const gap = 14; // écart cible ↔ bulle
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  // En "center" (ou tant que la cible n'est pas localisée) le spotlight se réduit à
  // un point central de taille 0 : le box-shadow garde le voile plein, l'anneau est
  // invisible. En "spot" il épouse la cible → géométrie animée = voyage fluide.
  const showSpot = mode === "spot" && !!rect;
  const spot =
    showSpot && rect
      ? {
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }
      : { top: vh / 2, left: vw / 2, width: 0, height: 0 };

  // Position de la bulle (numérique → animable au spring) : on choisit le côté avec
  // le plus de place puis on clampe dans l'écran. Centrée si pas de cible.
  let tipLeft: number;
  let tipTop: number;
  if (!showSpot) {
    tipLeft = vw / 2 - TW / 2;
    tipTop = vh / 2 - tipH / 2;
  } else {
    if (vw - (spot.left + spot.width) >= TW + gap) {
      // à droite (idéal pour la sidebar)
      tipLeft = spot.left + spot.width + gap;
      tipTop = spot.top + spot.height / 2 - tipH / 2;
    } else if (spot.left >= TW + gap) {
      // à gauche
      tipLeft = spot.left - TW - gap;
      tipTop = spot.top + spot.height / 2 - tipH / 2;
    } else if (vh - (spot.top + spot.height) >= tipH + gap) {
      // dessous
      tipTop = spot.top + spot.height + gap;
      tipLeft = spot.left + spot.width / 2 - TW / 2;
    } else {
      // dessus
      tipTop = spot.top - tipH - gap;
      tipLeft = spot.left + spot.width / 2 - TW / 2;
    }
    tipLeft = clamp(tipLeft, M, vw - TW - M);
    tipTop = clamp(tipTop, M, vh - tipH - M);
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80]">
        {/* Voile + spotlight toujours montés : la géométrie est animée au spring →
            le trou voyage vers la nouvelle cible au lieu de disparaître/réapparaître.
            Le box-shadow porte le voile (opacité constante), l'anneau est un enfant
            dont seule l'opacité varie → le voile ne clignote pas en mode centré. */}
        <motion.div
          className="pointer-events-none absolute rounded-xl"
          initial={false}
          animate={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 40 }}
          style={{ boxShadow: "0 0 0 9999px rgba(4,6,10,0.78)" }}
        />

        {/* Capte les clics hors bulle (tour guidé). */}
        <div className="absolute inset-0" onClick={() => {}} />

        {/* Bulle — reste montée entre les étapes : left/top animés au spring → elle
            glisse vers la nouvelle position au lieu de re-popper (key retirée exprès). */}
        <motion.div
          ref={tipRef}
          role="dialog"
          aria-modal="true"
          aria-label={shown.title}
          className="absolute flex flex-col gap-3 border border-white/[0.1] bg-white/[0.05] p-[var(--bezel)] shadow-[0_32px_90px_-24px_rgba(0,0,0,0.95)]"
          style={{ width: TW, borderRadius: "var(--r-card)" }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1, left: tipLeft, top: tipTop }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 380, damping: 40, opacity: { duration: 0.2 } }
          }
        >
          <div
            className="flex flex-col gap-3 bg-gradient-to-b from-surface-2 to-surface p-5"
            style={{ borderRadius: "calc(var(--r-card) - var(--bezel))" }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-extrabold tracking-tight">{shown.title}</h2>
              <button
                onClick={finish}
                aria-label="Passer le tuto"
                className="-mt-1 grid size-7 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              >
                <TbX size={16} />
              </button>
            </div>
            <p className="text-sm text-ink-dim">{shown.body}</p>

            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i === shownIndex
                        ? "h-1.5 w-4 rounded-full bg-brand"
                        : "size-1.5 rounded-full bg-white/20"
                    }
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {shownIndex > 0 && (
                  <button
                    onClick={() => setIndex(shownIndex - 1)}
                    aria-label="Précédent"
                    className="grid size-8 place-items-center rounded-full border border-white/[0.16] bg-white/[0.045] text-ink transition-colors hover:border-brand hover:text-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    <TbArrowLeft size={15} />
                  </button>
                )}
                <button
                  onClick={() => (isLast ? finish() : setIndex(shownIndex + 1))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  {isLast ? "C'est parti" : "Suivant"}
                  {!isLast && <TbArrowRight size={15} />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
