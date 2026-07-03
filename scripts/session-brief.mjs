#!/usr/bin/env node
// SessionStart hook (after preflight): tells the current user which of their
// tickets the OTHER person has just unblocked, by resolving the `🔗 dépend de
// #x` lines against live GitHub state. Stateless — nothing to store or clear.
//
// Fail-soft by design: any error (gh missing, offline, rate-limit) prints
// nothing and exits 0. A session must never fail to start because of a brief.
//
// Test as the other person: SESSION_BRIEF_AS=arthur node scripts/session-brief.mjs

import { execFileSync } from "node:child_process";

const OWNERS = {
  LilStick: { label: "lilstick", name: "Noé", other: "Arthur" },
  luminescencedev: { label: "arthur", name: "Arthur", other: "Noé" },
};

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

try {
  const forced = process.env.SESSION_BRIEF_AS; // "arthur" | "lilstick" (tests)
  const login = forced
    ? forced === "arthur"
      ? "luminescencedev"
      : "LilStick"
    : gh(["api", "user", "--jq", ".login"]).trim();
  const me = OWNERS[login];
  if (!me) process.exit(0);

  const mine = JSON.parse(
    gh([
      "issue",
      "list",
      "--state",
      "open",
      "--label",
      me.label,
      "--limit",
      "100",
      "--json",
      "number,title,body,labels",
    ]),
  ).filter((i) => !i.labels.some((l) => l.name === "epic"));

  const withDeps = mine
    .map((i) => ({
      number: i.number,
      title: i.title,
      deps: [...i.body.matchAll(/d[ée]pend de #(\d+)/gi)].map((m) => Number(m[1])),
    }))
    .filter((i) => i.deps.length > 0);
  if (withDeps.length === 0) process.exit(0);

  // Resolve each distinct dependency once.
  const depState = new Map();
  for (const dep of new Set(withDeps.flatMap((i) => i.deps))) {
    try {
      depState.set(
        dep,
        JSON.parse(gh(["issue", "view", String(dep), "--json", "number,title,state,closedAt"])),
      );
    } catch {
      // dep unreadable → treat as still open so we never announce a false unblock
      depState.set(dep, { number: dep, title: "?", state: "OPEN", closedAt: null });
    }
  }

  const unblocked = [];
  const blocked = [];
  for (const t of withDeps) {
    const deps = t.deps.map((d) => depState.get(d));
    if (deps.every((d) => d.state === "CLOSED")) unblocked.push({ ...t, deps });
    else blocked.push({ ...t, open: deps.filter((d) => d.state !== "CLOSED") });
  }

  if (unblocked.length === 0 && blocked.length === 0) process.exit(0);

  const lines = [`\n  🎟️  Tickets ${me.name} — état des dépendances`];
  for (const t of unblocked) {
    const closed = t.deps
      .map((d) => `#${d.number} fermé le ${d.closedAt ? d.closedAt.slice(0, 10) : "?"}`)
      .join(", ");
    lines.push(`  🔓 #${t.number} · ${t.title} — DÉBLOQUÉ par ${me.other} (${closed})`);
  }
  for (const t of blocked) {
    lines.push(`  ⛔ #${t.number} · ${t.title} — attend ${t.open.map((d) => `#${d.number}`).join(", ")}`);
  }
  if (unblocked.length > 0) {
    lines.push(`  → piochable maintenant : /start-ticket sur le(s) 🔓 ci-dessus`);
  }
  console.log(lines.join("\n") + "\n");
} catch {
  // never block a session start
}
process.exit(0);
