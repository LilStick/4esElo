import { Link, Route, Routes } from "react-router-dom";
import { Crosshair } from "lucide-react";
import { Leaderboard } from "./pages/Leaderboard";
import { Player } from "./pages/Player";

export function App() {
  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4">
      <header className="flex items-center gap-2 py-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Crosshair className="size-5 text-orange-500" />
          <span>4esElo</span>
          <span className="text-zinc-500">· CS2</span>
        </Link>
      </header>

      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/player/:id" element={<Player />} />
        </Routes>
      </main>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-600">
        Classement du pôle CS2 · données Faceit
      </footer>
    </div>
  );
}
