import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getPlayer } from "../lib/api";
import { LevelBadge } from "../components/LevelBadge";
import { EloChart } from "../components/EloChart";

export function Player() {
  const { id = "" } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["player", id],
    queryFn: () => getPlayer(id),
    enabled: id.length > 0,
  });

  return (
    <div>
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="size-4" /> Classement
      </Link>

      {isLoading && <p className="text-zinc-500">Chargement…</p>}
      {isError && <p className="text-red-400">Joueur introuvable.</p>}

      {data && (
        <>
          <div className="mb-8 flex items-center gap-4">
            <LevelBadge level={data.level} />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{data.faceitNickname ?? data.discordName ?? "Joueur"}</h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
                {data.faceitNickname && (
                  <a
                    href={`https://www.faceit.com/fr/players/${data.faceitNickname}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-orange-400"
                  >
                    Faceit <ExternalLink className="size-3" />
                  </a>
                )}
                {data.steamId64 && (
                  <a
                    href={`https://steamcommunity.com/profiles/${data.steamId64}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-orange-400"
                  >
                    Steam <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-3xl font-bold text-orange-400 tabular-nums">
                {data.elo ?? "—"}
              </div>
              <div className="text-xs text-zinc-500">ELO Faceit</div>
            </div>
          </div>

          <h2 className="mb-3 text-sm font-semibold text-zinc-400">Évolution de l'ELO</h2>
          <EloChart points={data.history} />
        </>
      )}
    </div>
  );
}
