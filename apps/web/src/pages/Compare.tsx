import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import {
  TbActivity,
  TbBolt,
  TbCrosshair,
  TbDeviceGamepad2,
  TbFlame,
  TbGitCompare,
  TbMedal,
  TbPercentage,
  TbPlus,
  TbSearch,
  TbSwords,
  TbTrophy,
} from "react-icons/tb";
import type { IconType } from "react-icons";
import type { LeaderboardEntry, StatsAggregate } from "@4eselo/types";
import { getLeaderboard, getPlayerStats } from "../lib/api";
import { discordAvatarUrl } from "../lib/discord";
import { Avatar, Card, LevelBadge, Modal } from "../ui";
import { cn } from "../lib/cn";
import { useTitle } from "../lib/useTitle";
import vsLogo from "../assets/compare/vs_logo.png";
import faceoffBg from "../assets/maps/screens/de_ancient.png";

const A_COLOR = "#5E8BFF";
const B_COLOR = "#34D8A0";
const nameOf = (e: LeaderboardEntry) => e.discordName ?? e.faceitNickname ?? "-";
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
const clamp = (n: number) => Math.max(0, Math.min(100, n));

function axes(o: StatsAggregate) {
  return {
    Aim: clamp(o.hsPercent),
    Impact: clamp(((o.kd - 0.6) / 1.0) * 100),
    Clutch: clamp(o.clutchWinRate),
    Entry: clamp(o.entrySuccessRate),
    Utility: clamp((o.utilityDamagePerMatch / 120) * 100),
    Win: clamp(o.winRate),
  };
}

/** Valeurs réelles des axes du radar (pour flanquer le graphe). */
function statList(o: StatsAggregate): { label: string; value: string }[] {
  return [
    { label: "Aim", value: `${Math.round(o.hsPercent)}%` },
    { label: "Impact", value: o.kd.toFixed(2) },
    { label: "Clutch", value: `${Math.round(o.clutchWinRate)}%` },
    { label: "Entry", value: `${Math.round(o.entrySuccessRate)}%` },
    { label: "Utility", value: String(Math.round(o.utilityDamagePerMatch)) },
    { label: "Win", value: `${Math.round(o.winRate)}%` },
  ];
}

/** Colonne de stats flanquant le radar. `side` = de quel côté (aligne le texte). */
function RadarFlank({ o, color, side }: { o: StatsAggregate; color: string; side: "left" | "right" }) {
  return (
    <div className="hidden flex-col justify-center gap-3 lg:flex">
      {statList(o).map((s) => (
        <div
          key={s.label}
          className={cn("flex items-baseline gap-2", side === "left" ? "flex-row-reverse text-right" : "")}
        >
          <span className="w-16 text-[11px] tracking-[0.1em] text-ink-faint uppercase">{s.label}</span>
          <span className="flex-1 font-mono text-sm font-bold tabular-nums" style={{ color }}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Panneau joueur (façon carte de match) - cliquable pour (re)choisir. */
function PlayerPanel({
  entry,
  color,
  slot,
  onPick,
}: {
  entry: LeaderboardEntry | undefined;
  color: string;
  slot: string;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className="group relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl bg-white/[0.02] p-6 text-center ring-1 ring-white/[0.04] transition-all duration-200 hover:scale-[1.03] hover:ring-white/[0.12]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-50 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 50% 0%, ${color}26, transparent 70%)` }}
      />
      {entry ? (
        <div className="relative flex flex-col items-center gap-3">
          <Avatar
            name={nameOf(entry)}
            size={84}
            src={discordAvatarUrl(entry.discordId, entry.discordAvatar)}
          />
          <div>
            <div className="text-lg font-extrabold" style={{ color }}>
              {nameOf(entry)}
            </div>
            <div className="mt-1 flex items-center justify-center gap-2">
              <LevelBadge level={entry.level} size={20} />
              <span className="font-mono text-sm font-bold text-ink tabular-nums">{entry.elo ?? "-"}</span>
            </div>
          </div>
          <span className="text-[11px] text-ink-faint underline-offset-2 group-hover:underline">Changer</span>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-3 py-2">
          <span
            className="grid size-[84px] animate-pulse place-items-center rounded-full border border-dashed text-ink-faint transition-colors group-hover:text-ink"
            style={{ borderColor: `${color}66` }}
          >
            <TbPlus size={28} />
          </span>
          <div className="text-sm font-semibold text-ink-dim">Choisir {slot}</div>
        </div>
      )}
    </button>
  );
}

function CmpRow({
  icon: Icon,
  label,
  a,
  b,
  fmt,
}: {
  icon: IconType;
  label: string;
  a: number | null;
  b: number | null;
  fmt: (n: number) => string;
}) {
  const aWins = a != null && b != null && a > b;
  const bWins = a != null && b != null && b > a;
  const total = (a ?? 0) + (b ?? 0);
  const aPct = total > 0 ? ((a ?? 0) / total) * 100 : 50;

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between text-sm">
        <span className={cn("font-mono font-bold tabular-nums", aWins ? "text-brand" : "text-ink")}>
          {a != null ? fmt(a) : "-"}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] tracking-[0.1em] text-ink-faint uppercase">
          <Icon size={13} /> {label}
        </span>
        <span className={cn("font-mono font-bold tabular-nums", bWins ? "text-win" : "text-ink")}>
          {b != null ? fmt(b) : "-"}
        </span>
      </div>
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="h-full bg-brand" style={{ width: `${aPct}%` }} />
        <span className="h-full flex-1 bg-win" />
      </div>
    </div>
  );
}

export function Compare() {
  useTitle("Comparer");
  const [params, setParams] = useSearchParams();
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const [pickQ, setPickQ] = useState("");
  const aId = params.get("a") ?? "";
  const bId = params.get("b") ?? "";

  const { data: lb } = useQuery({
    queryKey: ["leaderboard", "faceit"],
    queryFn: () => getLeaderboard("faceit"),
  });
  const players = lb?.leaderboard ?? [];
  const aEntry = players.find((p) => p.id === aId);
  const bEntry = players.find((p) => p.id === bId);

  // Picker : recherche + scroll (dans une modale, taper pour filtrer > pages numérotées).
  const pickable = players.filter(
    (p) =>
      p.id !== (picking === "a" ? bId : aId) &&
      (pickQ.trim() === "" || norm(nameOf(p)).includes(norm(pickQ.trim()))),
  );
  useEffect(() => setPickQ(""), [picking]); // vide la recherche à chaque ouverture

  const statsA = useQuery({
    queryKey: ["stats", aId, "all"],
    queryFn: () => getPlayerStats(aId, "all"),
    enabled: !!aId,
  });
  const statsB = useQuery({
    queryKey: ["stats", bId, "all"],
    queryFn: () => getPlayerStats(bId, "all"),
    enabled: !!bId,
  });

  const pick = (id: string) => {
    if (!picking) return;
    const next = new URLSearchParams(params);
    next.set(picking, id);
    setParams(next, { replace: true });
    setPicking(null);
  };

  const oA = statsA.data?.overall;
  const oB = statsB.data?.overall;
  const ready = !!oA && !!oB;
  const axA = oA ? axes(oA) : null;
  const axB = oB ? axes(oB) : null;
  const radar =
    axA && axB
      ? Object.keys(axA).map((k) => ({
          axis: k,
          vA: axA[k as keyof typeof axA],
          vB: axB[k as keyof typeof axB],
        }))
      : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TbGitCompare className="text-brand" size={22} /> Comparer
        </h1>
        <p className="mt-1 text-sm text-ink-dim">Deux membres face à face - radar et stats côte à côte.</p>
      </div>

      {/* Face-à-face */}
      <Card className="relative overflow-hidden p-5">
        {/* Fond : screen de map assombri + teintes bleu/vert */}
        <img
          src={faceoffBg}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover opacity-[0.13]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/40 to-bg/80"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-y-0 left-0 w-1/2"
            style={{ background: `linear-gradient(to right, ${A_COLOR}22, transparent)` }}
          />
          <div
            className="absolute inset-y-0 right-0 w-1/2"
            style={{ background: `linear-gradient(to left, ${B_COLOR}22, transparent)` }}
          />
        </div>
        <div className="relative grid grid-cols-2 gap-3 sm:gap-8">
          <PlayerPanel entry={aEntry} color={A_COLOR} slot="joueur A" onPick={() => setPicking("a")} />
          <PlayerPanel entry={bEntry} color={B_COLOR} slot="joueur B" onPick={() => setPicking("b")} />
        </div>
        {/* VS par-dessus, chevauchant les deux panneaux */}
        <img
          src={vsLogo}
          alt="VS"
          className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-20 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_22px_rgba(255,80,40,0.6)] sm:size-28"
        />
      </Card>

      {ready && (
        <div className="mt-6 flex flex-col gap-6">
          {/* Radar superposé, flanqué des stats */}
          <Card className="grid items-center gap-4 p-5 lg:grid-cols-[1fr_380px_1fr]">
            <RadarFlank o={oA!} color={A_COLOR} side="left" />
            <div className="mx-auto h-[340px] w-full max-w-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: "#8b90a0", fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="vA"
                    stroke={A_COLOR}
                    strokeWidth={2}
                    fill={A_COLOR}
                    fillOpacity={0.18}
                    isAnimationActive={false}
                  />
                  <Radar
                    dataKey="vB"
                    stroke={B_COLOR}
                    strokeWidth={2}
                    fill={B_COLOR}
                    fillOpacity={0.18}
                    isAnimationActive={false}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <RadarFlank o={oB!} color={B_COLOR} side="right" />
          </Card>

          {/* Tableau comparatif */}
          <Card className="flex flex-col gap-1 p-5">
            <CmpRow
              icon={TbTrophy}
              label="ELO"
              a={aEntry?.elo ?? null}
              b={bEntry?.elo ?? null}
              fmt={(n) => String(n)}
            />
            <CmpRow
              icon={TbMedal}
              label="Niveau"
              a={aEntry?.level ?? null}
              b={bEntry?.level ?? null}
              fmt={(n) => String(n)}
            />
            <CmpRow
              icon={TbDeviceGamepad2}
              label="Matchs"
              a={oA!.matches}
              b={oB!.matches}
              fmt={(n) => String(n)}
            />
            <CmpRow
              icon={TbPercentage}
              label="Winrate"
              a={oA!.winRate}
              b={oB!.winRate}
              fmt={(n) => `${Math.round(n)}%`}
            />
            <CmpRow icon={TbSwords} label="K/D" a={oA!.kd} b={oB!.kd} fmt={(n) => n.toFixed(2)} />
            <CmpRow icon={TbActivity} label="ADR" a={oA!.adr} b={oB!.adr} fmt={(n) => n.toFixed(0)} />
            <CmpRow
              icon={TbCrosshair}
              label="HS %"
              a={oA!.hsPercent}
              b={oB!.hsPercent}
              fmt={(n) => `${Math.round(n)}%`}
            />
            <CmpRow
              icon={TbBolt}
              label="Clutch"
              a={oA!.clutchWinRate}
              b={oB!.clutchWinRate}
              fmt={(n) => `${Math.round(n)}%`}
            />
            <CmpRow
              icon={TbFlame}
              label="Entry"
              a={oA!.entrySuccessRate}
              b={oB!.entrySuccessRate}
              fmt={(n) => `${Math.round(n)}%`}
            />
          </Card>
        </div>
      )}

      {/* Picker - exclut le joueur déjà choisi de l'autre côté */}
      <Modal open={picking !== null} onClose={() => setPicking(null)} title="Choisir un joueur">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <TbSearch
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
              size={16}
            />
            <input
              value={pickQ}
              onChange={(e) => setPickQ(e.target.value)}
              placeholder="Rechercher un membre…"
              autoFocus
              className="w-full rounded-xl border border-white/[0.09] bg-white/[0.02] py-2.5 pr-3 pl-9 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand/60"
            />
          </div>
          <div className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto">
            {pickable.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-ink-dim">Aucun membre trouvé.</p>
            ) : (
              pickable.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
                >
                  <Avatar name={nameOf(p)} size={32} src={discordAvatarUrl(p.discordId, p.discordAvatar)} />
                  <LevelBadge level={p.level} size={20} />
                  <span className="flex-1 truncate text-sm font-semibold">{nameOf(p)}</span>
                  <span className="font-mono text-sm font-bold text-brand tabular-nums">{p.elo ?? "-"}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
