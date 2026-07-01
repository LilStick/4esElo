import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Leaderboard } from "./pages/Leaderboard";
import { Player } from "./pages/Player";
import { Styleguide } from "./pages/Styleguide";

export function App() {
  return (
    <>
      <div className="grain" />
      <AppShell>
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/player/:id" element={<Player />} />
          {/* Charte / styleguide : accessible en direct, volontairement absente du nav. */}
          <Route path="/charte" element={<Styleguide />} />
        </Routes>
      </AppShell>
    </>
  );
}
