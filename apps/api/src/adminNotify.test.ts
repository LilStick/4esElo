import { test } from "node:test";
import assert from "node:assert/strict";
import type { DiscordBot, DiscordBotMessage } from "@4eselo/discord";
import { adminNotifyDeps, notifyAdminAction } from "./adminNotify";

function fakeBot() {
  const calls: { channelId: string; title: string }[] = [];
  const bot: DiscordBot = {
    postMessage: async (channelId: string, msg: DiscordBotMessage) => {
      calls.push({ channelId, title: msg.title ?? "" });
      return "msg-id";
    },
    react: async () => {},
  };
  return { calls, bot };
}

test("notifyAdminAction : poste quand bot + salon configurés", async () => {
  const f = fakeBot();
  adminNotifyDeps.bot = f.bot;
  adminNotifyDeps.channelId = "chan-123";
  await notifyAdminAction("🔨 Ban", "test");
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0]!.channelId, "chan-123");
  assert.equal(f.calls[0]!.title, "🔨 Ban");
});

test("notifyAdminAction : no-op si salon absent", async () => {
  const f = fakeBot();
  adminNotifyDeps.bot = f.bot;
  adminNotifyDeps.channelId = null;
  await notifyAdminAction("🔨 Ban", "test");
  assert.equal(f.calls.length, 0);
});

test("notifyAdminAction : une erreur Discord ne remonte pas (best-effort)", async () => {
  adminNotifyDeps.bot = {
    postMessage: async () => {
      throw new Error("discord down");
    },
    react: async () => {},
  };
  adminNotifyDeps.channelId = "chan-123";
  await assert.doesNotReject(notifyAdminAction("🔨 Ban", "test"));
});
