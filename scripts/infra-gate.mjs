#!/usr/bin/env node
// PreToolUse hook (Claude Code): blocks infra-dependent commands when Postgres
// is unreachable, instead of letting them fail obscurely — or worse, succeed
// silently (`pnpm test` skips the integration tests when Postgres is down and
// still exits green).
//
// Reads the hook payload on stdin ({ tool_input: { command } }), exits:
//   0 → allow the command
//   2 → block it (stderr is shown to the agent)

import { existsSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Commands that need Postgres. dev:web (Vite only) and db:up (the fix) are exempt.
const NEEDS_DB =
  /pnpm (run )?(test|dev|dev:api|dev:worker|db:push|db:studio|db:migrate|sync:once)(\s|$|&|;)|add-player/;

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL; // override for tests
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return null;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) return m[1];
  }
  return null;
}

function tcpProbe(host, port, timeout = 800) {
  return new Promise((res) => {
    const sock = createConnection({ host, port });
    const done = (ok) => {
      sock.destroy();
      res(ok);
    };
    sock.setTimeout(timeout);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

let command = "";
try {
  command = JSON.parse(readStdin())?.tool_input?.command ?? "";
} catch {
  process.exit(0); // unparseable payload → never block
}

if (!NEEDS_DB.test(command)) process.exit(0);

const raw = databaseUrl();
if (!raw) process.exit(0); // no .env yet → preflight's problem, not ours

let host, port;
try {
  const u = new URL(raw);
  host = u.hostname;
  port = Number(u.port || 5432);
} catch {
  process.exit(0);
}

const up = await tcpProbe(host, port);
if (up) process.exit(0);

console.error(
  `Postgres injoignable (${host}:${port}) — cette commande en dépend.\n` +
    `Lance \`pnpm db:up\` (et le daemon Docker avant si besoin : colima start / Docker Desktop), puis réessaie.`,
);
process.exit(2);
