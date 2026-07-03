import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Leaderboard } from "./pages/Leaderboard";
import { Asso } from "./pages/Asso";
import { Player } from "./pages/Player";
import { Styleguide } from "./pages/Styleguide";
import { NotFound } from "./pages/NotFound";

/** Transition douce entre les routes (fondu + léger glissement). */
function AnimatedRoutes() {
  const location = useLocation();
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? {} : { opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/classement" element={<Leaderboard />} />
          <Route path="/asso" element={<Asso />} />
          <Route path="/player/:id" element={<Player />} />
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
