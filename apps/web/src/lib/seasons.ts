import type { Season } from "@4eselo/types";

/**
 * Id de la saison courante dans une liste de saisons (B19.4). Le back marque la
 * saison en cours par `endsAt === null`. Fallback : la dernière de la liste (la
 * plus récente), ou `undefined` si la liste est vide.
 */
export function currentSeasonId(seasons: Season[]): string | undefined {
  return seasons.find((s) => s.endsAt === null)?.id ?? seasons[seasons.length - 1]?.id;
}
