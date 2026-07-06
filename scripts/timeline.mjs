#!/usr/bin/env node
// Frise d'avancement des blocs — affichée en début de session (repo-catchup).
// Jamais périmée : compteurs live des milestones GitHub + libellés/notes de la
// table ROADMAP.md. Fail-soft : la moindre erreur → silence, exit 0.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BAR = 10;

try {
  // 1. Table ROADMAP → ordre, libellés, notes (⏸️ pause, etc.)
  const table = [];
  for (const line of readFileSync(join(ROOT, "ROADMAP.md"), "utf8").split("\n")) {
    const m = /^\|\s*(V1|B\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/.exec(line);
    if (m) table.push({ bloc: m[1], sujet: m[2].replaceAll("**", ""), statut: m[3] });
  }
  if (table.length === 0) process.exit(0);

  // 2. Compteurs GitHub par milestone ("Bloc <n> — …")
  const milestones = JSON.parse(
    execFileSync(
      "gh",
      [
        "api",
        "repos/LilStick/4esElo/milestones?state=all&per_page=50",
        "--jq",
        "[.[] | {title, open: .open_issues, closed: .closed_issues}]",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ),
  );
  const counts = new Map();
  for (const m of milestones) {
    const num = /^Bloc (\d+) —/.exec(m.title)?.[1];
    if (num) counts.set(`B${num}`, { open: m.open, closed: m.closed });
  }

  const lines = ["", "  🗺️  4esElo — la frise", "  " + "─".repeat(58)];
  for (const row of table) {
    const c = counts.get(row.bloc);
    const total = c ? c.open + c.closed : 0;
    const done = c?.closed ?? 0;
    const paused = row.statut.includes("⏸");
    let icon;
    if (paused) icon = "⏸️";
    else if (row.statut.includes("✅") || (total > 0 && c.open === 0)) icon = "✅";
    else if (done > 0) icon = "🔨";
    else icon = "⏳";

    const ratio = total > 0 ? done / total : icon === "✅" ? 1 : 0;
    const filled = Math.round(ratio * BAR);
    const bar = "█".repeat(filled) + "░".repeat(BAR - filled);
    const count = total > 0 ? `${done}/${total}` : "";
    const sujet = row.sujet.length > 42 ? row.sujet.slice(0, 41) + "…" : row.sujet;
    lines.push(`  ${icon} ${row.bloc.padEnd(4)} ${bar} ${count.padEnd(6)} ${sujet}`);
  }
  lines.push("  " + "─".repeat(58));
  lines.push("  ✅ fini · 🔨 en cours · ⏳ à venir · ⏸️ en pause");
  console.log(lines.join("\n") + "\n");
} catch {
  // jamais bloquant
}
process.exit(0);
