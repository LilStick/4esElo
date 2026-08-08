import { test } from "node:test";
import assert from "node:assert/strict";
import {
  refreshDiscordAvatars,
  type AvatarReader,
  type AvatarStore,
  type AvatarMember,
} from "./refreshAvatars";

function fakes(members: AvatarMember[], avatars: Record<string, string | null | "throw">) {
  const writes: { id: string; avatar: string | null }[] = [];
  const reader: AvatarReader = {
    getUserAvatar: async (discordId) => {
      const v = avatars[discordId];
      if (v === "throw") throw new Error("rate limited");
      return v ?? null;
    },
  };
  const store: AvatarStore = {
    membersWithDiscord: async () => members,
    setDiscordAvatar: async (id, avatar) => {
      writes.push({ id, avatar });
    },
  };
  return { reader, store, writes };
}

test("met à jour uniquement les hash qui ont changé (snapshot-on-change)", async () => {
  const f = fakes(
    [
      { id: "p1", discordId: "d1", discordAvatar: "old" }, // changé → new
      { id: "p2", discordId: "d2", discordAvatar: "same" }, // inchangé → skip
    ],
    { d1: "new", d2: "same" },
  );
  const res = await refreshDiscordAvatars(f.reader, f.store);
  assert.deepEqual(res, { checked: 2, updated: 1 });
  assert.deepEqual(f.writes, [{ id: "p1", avatar: "new" }]);
});

test("hash périmé → null (défaut Discord) : on efface le hash mort", async () => {
  const f = fakes([{ id: "p1", discordId: "d1", discordAvatar: "dead" }], { d1: null });
  const res = await refreshDiscordAvatars(f.reader, f.store);
  assert.deepEqual(res, { checked: 1, updated: 1 });
  assert.deepEqual(f.writes, [{ id: "p1", avatar: null }]);
});

test("échec de lecture d'un membre → on ne l'écrase pas (best-effort), les autres continuent", async () => {
  const f = fakes(
    [
      { id: "p1", discordId: "d1", discordAvatar: "keep" }, // fetch throw → pas touché
      { id: "p2", discordId: "d2", discordAvatar: "old" }, // ok → mis à jour
    ],
    { d1: "throw", d2: "new" },
  );
  const res = await refreshDiscordAvatars(f.reader, f.store);
  assert.deepEqual(res, { checked: 2, updated: 1 });
  assert.deepEqual(f.writes, [{ id: "p2", avatar: "new" }]); // p1 jamais écrit
});
