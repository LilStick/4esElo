#!/usr/bin/env node
// Cross-platform environment check. Run before working on the project.
//   pnpm preflight
// Exits non-zero if a CRITICAL check fails, so agents/scripts can gate on it.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const add = (ok, critical, label, hint) => results.push({ ok, critical, label, hint });

function run(command) {
  const r = spawnSync(command, { shell: true, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

function parseEnv(path) {
  if (!existsSync(path)) return null;
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function tcpProbe(host, port, timeout = 1500) {
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

// 1. Node
const major = Number(process.versions.node.split(".")[0]);
add(major >= 20, true, `Node ${process.versions.node}`, "Install Node >= 20 (https://nodejs.org)");

// 2. pnpm
const pnpm = run("pnpm --version");
add(pnpm.ok, true, pnpm.ok ? `pnpm ${pnpm.out}` : "pnpm not found", "Install pnpm: npm i -g pnpm");

// 3. Docker daemon reachable
const docker = run('docker info --format "{{.ServerVersion}}"');
add(
  docker.ok,
  true,
  docker.ok ? `Docker daemon OK (server ${docker.out})` : "Docker daemon unreachable",
  "Start Docker - Windows: Docker Desktop or WSL2 | macOS: `colima start` (or Docker Desktop) | Linux: `sudo systemctl start docker`",
);

// 4. Dependencies installed
add(existsSync(join(ROOT, "node_modules")), true, "Dependencies installed", "Run `pnpm install`");

// 5. .env present + keys
const env = parseEnv(join(ROOT, ".env"));
add(
  env !== null,
  true,
  ".env present",
  "Copy it: `cp .env.example .env` (Windows: `copy .env.example .env`)",
);
if (env) {
  add(!!env.DATABASE_URL, true, "DATABASE_URL set", "Set DATABASE_URL in .env (see .env.example)");
  add(
    !!env.FACEIT_API_KEY,
    false,
    env.FACEIT_API_KEY ? "FACEIT_API_KEY set" : "FACEIT_API_KEY missing (optional)",
    "Get a server-side key at https://developers.faceit.com - needed only to fetch real data",
  );
}

// 6. Postgres reachable (from DATABASE_URL)
if (env?.DATABASE_URL) {
  try {
    const u = new URL(env.DATABASE_URL);
    const up = await tcpProbe(u.hostname, Number(u.port || 5432));
    add(
      up,
      true,
      `Postgres reachable (${u.hostname}:${u.port || 5432})`,
      "Start it: `pnpm db:up` (needs Docker running)",
    );
  } catch {
    add(false, true, "DATABASE_URL is not a valid URL", "Fix DATABASE_URL in .env");
  }
}

// Report
console.log("\n  4esElo - preflight\n  " + "-".repeat(40));
for (const r of results) {
  const icon = r.ok ? "✓" : r.critical ? "✗" : "!";
  console.log(`  ${icon} ${r.label}`);
  if (!r.ok) console.log(`      → ${r.hint}`);
}

const failed = results.filter((r) => !r.ok && r.critical);
const warned = results.filter((r) => !r.ok && !r.critical);
console.log("  " + "-".repeat(40));
if (failed.length === 0) {
  console.log(`  Ready to work.${warned.length ? ` (${warned.length} optional warning)` : ""}\n`);
  process.exit(0);
} else {
  console.log(`  ${failed.length} blocking issue(s) - fix the ✗ above before working.\n`);
  process.exit(1);
}
