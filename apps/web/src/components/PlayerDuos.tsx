import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { TbHeartHandshake } from "react-icons/tb";
import { getPlayerDuos } from "../lib/api";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Card, HoverBarList } from "../ui";

/**
 * Encart profil « avec qui je win le + » (B4.2) : top 3 des coéquipiers du
 * joueur par winrate. Masqué (aucun DOM) si le joueur n'a pas de duo éligible.
 */
export function PlayerDuos({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["playerDuos", id], queryFn: () => getPlayerDuos(id) });
  const duos = data?.duos ?? [];
  if (duos.length === 0) return null;

  const partnerOf = (duo: (typeof duos)[number]) => duo.players.find((p) => p.id !== id) ?? duo.players[0]!;
  const top = duos.slice(0, 3);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        <TbHeartHandshake size={14} className="text-brand" />
        Avec qui il win le +
      </div>
      <HoverBarList
        items={top}
        rowHeight={48}
        keyOf={(duo) => partnerOf(duo).id}
        onSelect={(duo) => navigate(`/player/${partnerOf(duo).id}`)}
        children={(duo) => {
          const partner = partnerOf(duo);
          return (
            <>
              <Avatar
                name={partner.nickname}
                size={30}
                src={discordAvatarUrl(partner.discordId, partner.discordAvatar)}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{partner.nickname}</span>
              <span className="font-mono text-sm font-bold text-win tabular-nums">
                {Math.round(duo.winRate)}%
              </span>
              <span className="w-12 text-right font-mono text-[11px] text-ink-faint tabular-nums">
                {duo.matches} g
              </span>
            </>
          );
        }}
      />
    </Card>
  );
}
