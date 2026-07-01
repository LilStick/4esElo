import { Link, NavLink, Route, Routes } from "react-router-dom";
import { Crosshair } from "lucide-react";
import { Leaderboard } from "./pages/Leaderboard";
import { Player } from "./pages/Player";
import { Styleguide } from "./pages/Styleguide";
import { cn } from "./lib/cn";

export function App() {
  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4">
      <div className="grain" />
      <header className="flex items-center gap-6 py-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Crosshair className="size-5 text-brand" />
          <span>4esElo</span>
          <span className="text-ink-faint">· CS2</span>
        </Link>
        <nav className="ml-auto flex items-center gap-5 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) => cn("transition-colors", isActive ? "text-ink" : "text-ink-dim hover:text-ink")}
          >
            Classement
          </NavLink>
          <NavLink
            to="/charte"
            className={({ isActive }) => cn("transition-colors", isActive ? "text-ink" : "text-ink-dim hover:text-ink")}
          >
            Charte
          </NavLink>
        </nav>
      </header>

      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/charte" element={<Styleguide />} />
        </Routes>
      </main>

      <footer className="border-t border-white/[0.09] py-4 text-center text-xs text-ink-faint">
        Classement du pôle CS2 · données Faceit
      </footer>
    </div>
  );
}
