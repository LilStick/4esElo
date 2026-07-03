import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Leaderboard } from "./pages/Leaderboard";
import { Asso } from "./pages/Asso";
import { Player } from "./pages/Player";
import { Styleguide } from "./pages/Styleguide";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <>
      <div className="grain" />
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/classement" element={<Leaderboard />} />
          <Route path="/asso" element={<Asso />} />
          <Route path="/player/:id" element={<Player />} />
          {/* Charte / styleguide : accessible en direct, volontairement absente du nav. */}
          <Route path="/charte" element={<Styleguide />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </>
  );
}
