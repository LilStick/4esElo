import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Leaderboard } from "./pages/Leaderboard";
import { Asso } from "./pages/Asso";
import { Player } from "./pages/Player";
import { Changelog } from "./pages/Changelog";
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
  // Home et profil en large ; le reste compact. Porté par la page (pas le shell) pour ne pas
  // reflow la page sortante pendant la transition.
  const wide = location.pathname === "/" || location.pathname.startsWith("/player/");
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className={`mx-auto w-full ${wide ? "max-w-[1560px]" : "max-w-4xl"}`}
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
