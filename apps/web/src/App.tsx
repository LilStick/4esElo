import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Leaderboard } from "./pages/Leaderboard";
import { Asso } from "./pages/Asso";
import { Player } from "./pages/Player";
import { Wrapped } from "./pages/Wrapped";
import { WrappedPlayer } from "./pages/WrappedPlayer";
import { Compare } from "./pages/Compare";
import { Social } from "./pages/Social";
import { Changelog } from "./pages/Changelog";
import { Register } from "./pages/Register";
import { Styleguide } from "./pages/Styleguide";
import { NotFound } from "./pages/NotFound";

/** Transition douce entre les routes (fondu + léger glissement). */
function AnimatedRoutes() {
  const location = useLocation();
  const reduce = useReducedMotion();
  // Remonte en haut à chaque changement de page (sinon on atterrit au milieu).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);
  // Largeur max par page (portée par la page, pas le shell, pour ne pas reflow pendant la transition) :
  // profil = large (mise en page centrée), home/compare = intermédiaire, reste = compact.
  const p = location.pathname;
  const maxw = p.startsWith("/player/")
    ? "max-w-[1400px]"
    : p === "/" || p === "/compare"
      ? "max-w-6xl"
      : "max-w-4xl";
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className={`mx-auto w-full ${maxw}`}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? {} : { opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/classement" element={<Leaderboard />} />
          <Route path="/asso" element={<Asso />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/wrapped/:period" element={<Wrapped />} />
          <Route path="/wrapped/:period/:player" element={<WrappedPlayer />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/social" element={<Social />} />
          <Route path="/register" element={<Register />} />
          <Route path="/changelog" element={<Changelog />} />
          {/* Charte / styleguide : accessible en direct, volontairement absente du nav. */}
          <Route path="/charte" element={<Styleguide />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <>
      <div className="grain" />
      <AppShell>
        <AnimatedRoutes />
      </AppShell>
    </>
  );
}
