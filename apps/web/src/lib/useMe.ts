import { useQuery } from "@tanstack/react-query";
import type { MeResponse } from "@4eselo/types";
import { getMe } from "./api";
import { discordAvatarUrl } from "./discord";

const ANON: MeResponse = { authenticated: false };

/**
 * Session courante (B17.3). Un seul `/me` partagé (queryKey ["me"]) : le shell,
 * le classement, le register… lisent le même état. `invalidateQueries(["me"])`
 * après login/logout/register rafraîchit tout le monde.
 */
export function useMe() {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const me = data ?? ANON;
  return {
    isLoading,
    me,
    isAuthenticated: me.authenticated,
    player: me.authenticated ? me.player : null,
    isAdmin: me.authenticated ? me.isAdmin : false,
    displayName: me.authenticated ? me.displayName : null,
    // Avatar de session (frais à chaque connexion) prioritaire sur le snapshot DB du joueur.
    avatarUrl: me.authenticated
      ? discordAvatarUrl(me.discordId, me.avatar ?? me.player?.discordAvatar)
      : null,
  };
}
