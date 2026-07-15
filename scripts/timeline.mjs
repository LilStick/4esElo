#!/usr/bin/env node
// Frise d'avancement des blocs - affichée en début de session (repo-catchup).
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

  // 2. Compteurs GitHub par milestone ("Bloc <n> - …")
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
    const num = /^Bloc (\d+) -/.exec(m.title)?.[1];
    if (num) counts.set(`B${num}`, { open: m.open, closed: m.closed });
  }

  // 3. Propriétaires par bloc, depuis les labels des tickets (2 appels)
  const ownerOf = new Map(); // bloc -> {noe, arthur}
  for (const [label, key] of [
    ["lilstick", "noe"],
    ["arthur", "arthur"],
  ]) {
    const issues = JSON.parse(
      execFileSync(
        "gh",
        ["issue", "list", "--state", "all", "--label", label, "--limit", "300", "--json", "milestone,labels"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ),
    );
    for (const i of issues) {
      if (i.labels.some((l) => l.name === "epic")) continue;
      const num = /^Bloc (\d+) -/.exec(i.milestone?.title ?? "")?.[1];
      if (!num) continue;
      const o = ownerOf.get(`B${num}`) ?? { noe: 0, arthur: 0 };
      o[key] += 1;
      ownerOf.set(`B${num}`, o);
    }
  }
  const ownerLabel = (bloc) => {
    if (bloc === "V1") return "duo";
    const o = ownerOf.get(bloc);
    if (!o) return "à tick.";
    if (o.noe > 0 && o.arthur > 0) return "duo";
    return o.arthur > 0 ? "Arthur" : "Noé";
  };

  // Ordre de lecture : fini → en cours → à venir → pause (puis n° de bloc)
  const phase = (row) => {
    const c = counts.get(row.bloc);
    if (row.statut.includes("⏸")) return 3;
    if (row.statut.includes("✅") || (c && c.open === 0 && c.closed > 0) || row.bloc === "V1") return 0;
    if ((c?.closed ?? 0) > 0) return 1;
    return 2;
  };
  const ordered = [...table].sort(
    (a, b) => phase(a) - phase(b) || Number(a.bloc.slice(1) || 0) - Number(b.bloc.slice(1) || 0),
  );

  const lines = ["", "  🗺️  4esElo - la frise", "  " + "─".repeat(58)];
  for (const row of ordered) {
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
    const sujet = row.sujet.length > 36 ? row.sujet.slice(0, 35) + "…" : row.sujet;
    lines.push(
      `  ${icon} ${row.bloc.padEnd(4)} ${bar} ${count.padEnd(6)} ${ownerLabel(row.bloc).padEnd(7)} ${sujet}`,
    );
  }
  lines.push("  " + "─".repeat(58));
  const chemin = /\*\*Chemin actuel\*\* : (.+)$/m.exec(readFileSync(join(ROOT, "ROADMAP.md"), "utf8"))?.[1];
  if (chemin) lines.push("  🧭 " + chemin.replace(/\*\*/g, ""));
  lines.push(
    "  ✅ fini · 🔨 en cours · ⏳ à venir · ⏸️ pause · Noé = back, Arthur = front · à tick. = pas encore ticketé",
  );
  console.log(lines.join("\n") + "\n");
} catch {
  // jamais bloquant
}
process.exit(0);
