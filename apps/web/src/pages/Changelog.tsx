import { TbBrandDiscord, TbBrandGithub, TbRocket } from "react-icons/tb";
import { useTitle } from "../lib/useTitle";

const REPO = "https://github.com/LilStick/4esElo";
const DISCORD = "https://discord.gg/gEVQtdCv6N";

const V1_FEATURES = [
  { emoji: "🏆", text: "Classement ELO du pôle en temps réel" },
  { emoji: "📊", text: "Stats détaillées par match - ADR, clutch, entry…" },
  { emoji: "📈", text: "Courbe d'ELO depuis ton arrivée dans le pôle" },
  { emoji: "🥇", text: "Ta place dans l'asso sur chaque stat" },
  { emoji: "🤝", text: "Comparaison 2 joueurs, duos, stats sociales" },
  { emoji: "🎁", text: "Wrapped mensuel + BIG Wrapped de l'année" },
];

export function Changelog() {
  useTitle("Nouveautés");

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/8 px-4 py-1.5 text-xs font-bold tracking-[0.15em] text-brand uppercase">
          <TbRocket size={13} /> Nouveautés
        </div>
        <h1 className="text-3xl font-black tracking-tight">Retake</h1>
        <p className="mt-2 text-sm text-ink-faint">Le classement CS2 du pôle 4eSport.</p>
      </div>

      {/* Hero V1 */}
      <div className="relative overflow-hidden rounded-2xl border border-brand/25 bg-linear-to-br from-brand/10 via-surface to-surface p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="relative">
          <div className="mb-1 text-[10px] font-bold tracking-[0.2em] text-brand uppercase">Version 1.0</div>
          <h2 className="text-xl font-black tracking-tight">Le lancement 🎉</h2>
          <p className="mt-1.5 text-sm text-ink-dim">Retake débarque dans le pôle CS2 de 4eSport.</p>
          <ul className="mt-4 grid gap-y-2 sm:grid-cols-2">
            {V1_FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-2.5 text-sm">
                <span className="text-base leading-none">{f.emoji}</span>
                <span className="text-ink-dim">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Crédits */}
      <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/6 pt-8 text-center">
        <p className="text-sm text-ink-faint">
          Fait par <span className="font-semibold text-ink">Noé</span> &amp;{" "}
          <span className="font-semibold text-ink">Arthur</span> pour le pôle CS2 de 4eSport.
        </p>
        <div className="flex gap-3">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-ink-faint transition-colors hover:border-white/20 hover:text-ink"
          >
            <TbBrandGithub size={15} /> GitHub
          </a>
          <a
            href={DISCORD}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-ink-faint transition-colors hover:border-white/20 hover:text-ink"
          >
            <TbBrandDiscord size={15} /> Discord
          </a>
        </div>
      </div>
    </div>
  );
}
