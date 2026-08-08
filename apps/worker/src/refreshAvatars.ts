/**
 * Rafraîchit l'avatar Discord des membres (B11.20). On ne le mettait à jour qu'au
 * login (rare) → dès qu'un membre changeait sa pdp Discord, l'ancien hash stocké
 * partait en 404 et la pdp disparaissait du site (cas Lamune). Le worker la remet à
 * jour périodiquement. Logique pure (reader + store injectés) → testable sans I/O.
 */

export interface AvatarReader {
  /** Hash de l'avatar courant, ou null (pas d'avatar / introuvable). */
  getUserAvatar(discordId: string): Promise<string | null>;
}

export interface AvatarMember {
  id: string;
  discordId: string;
  discordAvatar: string | null;
}

export interface AvatarStore {
  membersWithDiscord(): Promise<AvatarMember[]>;
  setDiscordAvatar(playerId: string, avatar: string | null): Promise<void>;
}

/** Met à jour l'avatar des membres dont le hash a changé (snapshot-on-change). Best-effort par membre. */
export async function refreshDiscordAvatars(
  reader: AvatarReader,
  store: AvatarStore,
): Promise<{ checked: number; updated: number }> {
  const members = await store.membersWithDiscord();
  let updated = 0;
  for (const m of members) {
    let current: string | null;
    try {
      current = await reader.getUserAvatar(m.discordId);
    } catch {
      // Échec de lecture (rate-limit, réseau) : on NE touche à rien (surtout pas
      // écraser un hash valide par null). On réessaiera au prochain passage.
      continue;
    }
    if (current !== m.discordAvatar) {
      await store.setDiscordAvatar(m.id, current);
      updated++;
    }
  }
  return { checked: members.length, updated };
}
