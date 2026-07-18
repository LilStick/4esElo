import { useQuery } from "@tanstack/react-query";
import { getPremierEnabled } from "./api";

/**
 * Premier est-il activé côté serveur ? Lu via `GET /config` (public, B18.13).
 * Sert à masquer le toggle de source / l'onboarding quand Premier est off.
 */
export function usePremierEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ["premier-enabled"],
    queryFn: getPremierEnabled,
    staleTime: 5 * 60_000,
  });
  return data ?? false;
}
