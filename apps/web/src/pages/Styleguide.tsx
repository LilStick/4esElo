import { TbArrowRight, TbCrown, TbExternalLink, TbTrendingUp } from "react-icons/tb";
import { Button, Card, EloGauge, HoverBarList, LevelBadge } from "../ui";

const SWATCHES = [
  { name: "bg", hex: "#060709" },
  { name: "surface", hex: "#0C0E13" },
  { name: "surface-2", hex: "#11141B" },
  { name: "brand", hex: "#5E8BFF" },
  { name: "ink", hex: "#F4F6FA" },
  { name: "ink-dim", hex: "#8B90A0" },
  { name: "win", hex: "#34D8A0" },
  { name: "loss", hex: "#FB6474" },
];

type Row = { rank: number; name: string; level: number; elo: number; from: string };
const ROWS: Row[] = [
  { rank: 4, name: "Kiro", level: 8, elo: 2180, from: "#7A6ED0" },
  { rank: 5, name: "Arthur", level: 7, elo: 1890, from: "#5E8BFF" },
  { rank: 6, name: "Bibou", level: 6, elo: 1640, from: "#4E9AD0" },
  { rank: 7, name: "Womps", level: 5, elo: 1420, from: "#4ED0B0" },
  { rank: 8, name: "Tchoupi", level: 4, elo: 1180, from: "#59D9C4" },
];

const PODIUM = [
  { rank: 2, name: "Nyxøn", level: 9, elo: 2740, from: "#59D9C4", to: "#1E8A7A" },
  { rank: 1, name: "s1non", level: 10, elo: 3120, from: "#86A6FF", to: "#3A5CD8" },
  { rank: 3, name: "LilStick", level: 9, elo: 2510, from: "#8FB2FF", to: "#4A63B0" },
];

function Avatar({ from, to, letter, size }: { from: string; to?: string; letter: string; size: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(140deg, ${from}, ${to ?? from})` }}
    >
      {letter}
    </span>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <div className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">{children}</div>;
}

function SectionHead({ label, title, children }: { label: string; title: string; children: string }) {
  return (
    <div className="mb-6">
      <Eyebrow>{label}</Eyebrow>
      <h2 className="mt-2 text-[23px] font-bold tracking-[-0.03em]">{title}</h2>
      <p className="mt-2 max-w-[60ch] text-sm text-ink-dim">{children}</p>
    </div>
  );
}

export function Styleguide() {
  return (
    <div className="flex flex-col gap-[68px] pb-24">
      {/* Hero */}
      <section>
        <div className="text-[11px] font-bold tracking-[0.2em] text-brand uppercase">
          Direction · noir &amp; bleu · premium
        </div>
        <h1 className="mt-4 text-[clamp(34px,7vw,56px)] leading-[1] font-extrabold tracking-[-0.045em] text-balance">
          Un classement
          <br />
          qui a l'air cher.
        </h1>
        <p className="mt-4 max-w-[56ch] text-[15px] text-ink-dim">
          OLED noir, verre dépoli, cartes à double bordure usinée. Une seule couleur, le bleu électrique, posée
          uniquement sur ce qui compte. Le vert et le rouge ne servent qu'aux victoires et défaites.
        </p>
      </section>

      {/* Palette */}
      <section>
        <SectionHead label="Fondations" title="Palette & tokens">
          Variables CSS comme source de vérité (Tailwind v4). Règle des cartes : radius enfant = radius parent − bezel,
          donc tout reste concentrique.
        </SectionHead>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {SWATCHES.map((s) => (
            <Card key={s.name} className="p-[var(--bezel)]">
              <div
                className="h-16 rounded-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                style={{ background: s.hex }}
              />
              <div className="px-1.5 pt-2.5 pb-1">
                <div className="text-xs font-semibold">{s.name}</div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-dim">{s.hex}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Levels */}
      <section>
        <SectionHead label="Signalétique" title="Niveaux 1 à 10">
          Ici en placeholder coloré. Les vrais logos officiels Faceit seront intégrés au ticket B1.3 ; le code couleur
          (gris, teal, bleu, violet) restera notre habillage.
        </SectionHead>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 10 }, (_, i) => (
            <LevelBadge key={i} level={i + 1} size={48} />
          ))}
        </div>
      </section>

      {/* Components */}
      <section>
        <SectionHead label="Composants" title="Briques réutilisables">
          Jauge d'ELO animée, boutons (feedback au press, icône Tabler nichée), carte double-bezel. Base du ticket B1.2.
        </SectionHead>
        <Card className="flex flex-wrap items-center gap-10 p-5">
          <EloGauge elo={2510} pct={78} />
          <div>
            <Eyebrow>Actions</Eyebrow>
            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <Button icon={TbArrowRight}>Voir le profil</Button>
              <Button variant="ghost">Comparer</Button>
            </div>
            <p className="mt-4 max-w-[36ch] text-[13px] text-ink-dim">
              L'anneau se remplit en bleu. L'ELO est ce qui compte, donc c'est ce qui brille.
            </p>
          </div>
        </Card>
      </section>

      {/* Leaderboard */}
      <section>
        <SectionHead label="Écran principal" title="Classement">
          Podium top 3 (1er surélevé, couronne bleue), puis la liste : une barre unique glisse derrière la ligne
          survolée, comme les projets du portfolio.
        </SectionHead>

        <div className="mb-4 grid grid-cols-3 items-end gap-4">
          {PODIUM.map((p) => (
            <Card
              key={p.rank}
              outerClassName={p.rank === 1 ? "-translate-y-4 shadow-[0_0_40px_-14px_rgba(94,139,255,0.45),0_24px_60px_-30px_rgba(0,0,0,0.9)]" : undefined}
              className="relative p-5 text-center"
            >
              {p.rank === 1 && (
                <TbCrown className="absolute -top-3 left-1/2 -translate-x-1/2 text-brand drop-shadow-[0_0_8px_rgba(94,139,255,0.5)]" size={22} />
              )}
              <span className="absolute top-1.5 left-2 font-mono text-xs font-bold text-ink-faint">#{p.rank}</span>
              <div className="mx-auto mt-1.5 mb-3 w-fit">
                <Avatar from={p.from} to={p.to} letter={p.name.charAt(0)} size={60} />
              </div>
              <div className="text-[15px] font-bold">{p.name}</div>
              <div className="mt-2 flex justify-center">
                <LevelBadge level={p.level} size={26} />
              </div>
              <div className="mt-2 font-mono text-[23px] font-extrabold text-brand tabular-nums">{p.elo}</div>
            </Card>
          ))}
        </div>

        <Card className="p-[var(--bezel)]">
          <HoverBarList
            items={ROWS}
            rowHeight={56}
            keyOf={(r) => r.name}
            children={(r) => (
              <>
                <span className="w-5 text-center font-mono font-bold text-ink-faint">{r.rank}</span>
                <Avatar from={r.from} letter={r.name.charAt(0)} size={34} />
                <LevelBadge level={r.level} size={24} />
                <span className="flex-1 truncate font-semibold">{r.name}</span>
                <span className="font-mono text-[15px] font-bold text-brand tabular-nums">{r.elo}</span>
                <TbArrowRight className="text-ink-faint" size={17} />
              </>
            )}
          />
        </Card>
      </section>

      {/* Player */}
      <section>
        <SectionHead label="Écran joueur" title="Profil joueur">
          Header, ELO en gros, forme récente (W/L en vert/rouge), puis stats en bento.
        </SectionHead>

        <div className="flex flex-col gap-4">
        <Card className="flex flex-wrap items-center gap-5 p-5">
          <Avatar from="#8FB2FF" to="#4A63B0" letter="L" size={78} />
          <div>
            <h3 className="flex items-center gap-2 text-[27px] font-extrabold tracking-[-0.03em]">
              LilStick <LevelBadge level={9} size={26} />
            </h3>
            <div className="mt-2 flex gap-4 text-[13px] text-ink-dim">
              <a href="#" className="inline-flex items-center gap-1 hover:text-brand-hi">
                Faceit <TbExternalLink size={13} />
              </a>
              <a href="#" className="inline-flex items-center gap-1 hover:text-brand-hi">
                Steam <TbExternalLink size={13} />
              </a>
            </div>
            <div className="mt-3.5 flex gap-1.5">
              {["W", "W", "L", "W", "W", "L", "W", "W"].map((r, i) => (
                <span
                  key={i}
                  className={cnForm(r)}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="font-mono text-[42px] font-extrabold tracking-[-0.03em] text-brand [text-shadow:0_0_24px_rgba(94,139,255,0.4)]">
              2510
            </div>
            <div className="text-[11px] tracking-[0.16em] text-ink-faint uppercase">ELO</div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <Eyebrow>Évolution sur 30 derniers matchs</Eyebrow>
            <div className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold text-win">
              <TbTrendingUp size={15} />
              <span className="tabular-nums">+210</span>
            </div>
          </div>
          <p className="text-sm text-ink-dim">La courbe (recharts, habillée aux tokens) est branchée dans la page joueur réelle.</p>
        </Card>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <Card className="col-span-2 p-[18px]">
            <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">Win rate</div>
            <div className="mt-2 font-mono text-[28px] font-extrabold tracking-tight text-win tabular-nums">61%</div>
            <div className="mt-1 text-xs text-ink-dim">90 V · 58 D sur 148 matchs</div>
          </Card>
          {[
            ["K/D", "1.24"],
            ["ADR", "86.4"],
            ["HS %", "52%"],
            ["Clutch", "38%"],
            ["Entry", "1.4"],
            ["Matchs", "148"],
          ].map(([k, v]) => (
            <Card key={k} className="p-[18px]">
              <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">{k}</div>
              <div className="mt-2 font-mono text-[28px] font-extrabold tracking-tight tabular-nums">{v}</div>
            </Card>
          ))}
        </div>
        </div>
      </section>
    </div>
  );
}

function cnForm(r: string): string {
  const base = "grid size-[22px] place-items-center rounded-[6px] border font-mono text-[11px] font-extrabold";
  return r === "W"
    ? `${base} border-win/30 bg-win/15 text-win`
    : `${base} border-loss/30 bg-loss/15 text-loss`;
}
