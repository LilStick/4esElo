import { useMemo, type ReactNode } from "react";
import { TbBrandDiscord, TbBrandGithub, TbRocket, TbSparkles } from "react-icons/tb";
import raw from "../../../../CHANGELOG.md?raw";
import { Card } from "../ui";
import { cn } from "../lib/cn";
import { useTitle } from "../lib/useTitle";

const REPO = "https://github.com/LilStick/4esElo";
const DISCORD = "https://discord.gg/gEVQtdCv6N";

/** Ce que la V1 apporte — repères lisibles pour un membre, pas une liste technique. */
const V1_FEATURES = [
  "Classement ELO du pôle, mis à jour automatiquement",
  "Profils détaillés : stats par match, courbe d'ELO, ADR, clutch, entry…",
  "« Ta place dans l'asso » — ton percentile sur chaque stat",
  "Comparaison 2 joueurs, duos & stats sociales",
  "Wrapped mensuel + BIG Wrapped, heatmap d'activité",
  "Inscription en libre-service (Discord + Faceit)",
];

/** Couleur de badge par domaine (Web/API/Worker…), neutre par défaut. */
function domainClass(domain: string): string {
  if (domain === "Web") return "text-brand bg-brand/12";
  if (domain === "API") return "text-win bg-win/12";
  if (domain === "Worker") return "text-[#ffcf3f] bg-[#ffcf3f]/12";
  return "text-ink-dim bg-white/[0.05]";
}

type Entry = { domain: string | null; text: string };
type Section = { date: string; entries: Entry[] };

function parse(md: string): Section[] {
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const line of md.split("\n")) {
    if (line.startsWith("## ")) {
      cur = { date: line.slice(3).trim(), entries: [] };
      sections.push(cur);
    } else if (line.startsWith("- ") && cur) {
      const body = line.slice(2).trim();
      const idx = body.indexOf(" : ");
      if (idx > 0 && idx < 24) cur.entries.push({ domain: body.slice(0, idx), text: body.slice(idx + 3) });
      else cur.entries.push({ domain: null, text: body });
    }
  }
  return sections;
}

/** Rend un texte en liant les références de ticket (#123 → GitHub). */
function withTicketLinks(text: string): ReactNode[] {
  return text.split(/(#\d+)/g).map((part, i) => {
    const m = part.match(/^#(\d+)$/);
    if (!m) return part;
    return (
      <a
        key={i}
        href={`${REPO}/issues/${m[1]}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-brand transition-colors hover:text-brand-hi"
      >
        {part}
      </a>
    );
  });
}

export function Changelog() {
  useTitle("Nouveautés");
  const sections = useMemo(() => parse(raw), []);

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-brand">
          <TbSparkles size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveautés</h1>
          <p className="mt-1 text-sm text-ink-dim">Ce qui a changé sur le site, à chaque mise à jour.</p>
        </div>
      </div>

      {/* Hero de lancement V1 */}
      <Card className="mb-8 p-6">
        <div className="flex items-center gap-2 text-brand">
          <TbRocket size={20} />
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase">La V1 est là</span>
        </div>
        <h2 className="mt-3 text-xl font-extrabold tracking-tight">
          4esElo, le classement CS2 du pôle — enfin en ligne 🎉
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          Tout ce qu'il faut pour se comparer, suivre sa progression et se charrier entre membres de 4eSport.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {V1_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink-dim">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              {f}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-6">
        {sections.map((s) => (
          <div key={s.date}>
            <div className="mb-3 font-mono text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
              {s.date}
            </div>
            <Card className="flex flex-col gap-2.5 p-5">
              {s.entries.map((e, i) => (
                <div key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
                  {e.domain && (
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                        domainClass(e.domain),
                      )}
                    >
                      {e.domain}
                    </span>
                  )}
                  <span className="flex-1 text-ink-dim">{withTicketLinks(e.text)}</span>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>

      {/* Crédits */}
      <Card className="mt-8 flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-ink-dim">
          Conçu et développé par <b className="text-ink">Noé</b> &amp; <b className="text-ink">Arthur</b> pour
          le pôle CS2 de 4eSport.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] px-4 py-2 text-sm font-semibold text-ink-dim transition-colors hover:text-ink"
          >
            <TbBrandGithub size={16} /> GitHub
          </a>
          <a
            href={DISCORD}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] px-4 py-2 text-sm font-semibold text-ink-dim transition-colors hover:text-ink"
          >
            <TbBrandDiscord size={16} /> Discord
          </a>
        </div>
      </Card>
    </div>
  );
}
