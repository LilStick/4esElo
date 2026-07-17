import { useQuery } from "@tanstack/react-query";
import { getPremierEnabled } from "./api";

/**
 * Premier est-il activé côté serveur ? Détecté via `GET /premier/status`
 * (503 = désactivé). En attendant que `/me` expose `premierEnabled` (B18.13),
 * c'est le seul signal disponible. Sert à masquer le toggle / l'onboarding.
 */
export function usePremierEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ["premier-enabled"],
    queryFn: getPremierEnabled,
    staleTime: 5 * 60_000,
  });
  return data ?? false;
}
