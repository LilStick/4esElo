import { Link } from "react-router-dom";
import { discordAvatarUrl } from "../lib/discord";
import type { AwardGroup } from "../lib/awards";
import { Avatar, Card } from "../ui";

/**
 * Carte d'un award du pôle (Wrapped mensuel + BIG Wrapped). `linkTo` construit
 * le lien vers la page perso du gagnant selon la période (mensuelle ou longue).
 */
export function AwardCard({ g, linkTo }: { g: AwardGroup; linkTo: (playerId: string) => string }) {
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="text-4xl leading-none">{g.emoji}</span>
        <div className="text-lg font-bold">{g.title}</div>
      </div>

      <div className="flex flex-col gap-1.5">
        {g.winners.map((w) => (
          <Link
            key={w.playerId}
            to={linkTo(w.playerId)}
            className="group flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
          >
            <Avatar name={w.nickname} size={26} src={discordAvatarUrl(w.discordId, w.discordAvatar)} />
            <span className="flex-1 truncate text-sm font-semibold transition-colors group-hover:text-brand-hi">
              {w.nickname}
            </span>
            <span className="font-mono text-xs font-bold text-brand tabular-nums">{w.value}</span>
          </Link>
        ))}
      </div>

      <p className="mt-auto text-sm text-ink-dim italic">« {g.punchline} »</p>
    </Card>
  );
}
