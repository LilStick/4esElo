import type { AwardKey, AwardWinner } from "@4eselo/types";

export type AwardGroup = {
  award: AwardKey;
  emoji: string;
  title: string;
  punchline: string;
  winners: {
    playerId: string;
    nickname: string;
    value: number;
    discordId: string | null;
    discordAvatar: string | null;
  }[];
};

/** Regroupe les gagnants par award (ex æquo → une seule carte). */
export function groupAwards(awards: AwardWinner[]): AwardGroup[] {
  const map = new Map<AwardKey, AwardGroup>();
  for (const a of awards) {
    const winner = {
      playerId: a.playerId,
      nickname: a.nickname,
      value: a.value,
      discordId: a.discordId,
      discordAvatar: a.discordAvatar,
    };
    const g = map.get(a.award);
    if (g) g.winners.push(winner);
    else
      map.set(a.award, {
        award: a.award,
        emoji: a.emoji,
        title: a.title,
        punchline: a.punchline,
        winners: [winner],
      });
  }
  return [...map.values()];
}
