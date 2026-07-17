import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { IconType } from "react-icons";
import { TbBrandDiscord, TbInfoCircle, TbShieldCheck, TbUserPlus } from "react-icons/tb";
import { Card } from "../ui";
import { useTitle } from "../lib/useTitle";

function Section({ icon: Icon, title, children }: { icon: IconType; title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-brand">
          <Icon size={18} />
        </span>
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-ink-dim">{children}</div>
    </Card>
  );
}

export function Asso() {
  useTitle("L'asso");
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">L'asso</h1>
      <p className="mt-1 mb-8 text-sm text-ink-dim">
        Le classement CS2 du pôle - 4eSport, l'asso jeux vidéo de l'Efrei Paris.
      </p>

      <div className="flex flex-col gap-4">
        <Section icon={TbInfoCircle} title="C'est quoi Retake ?">
          Le classement ELO du pôle CS2 de <b className="text-ink">4eSport</b>, l'association jeux vidéo de l'
          <b className="text-ink">Efrei Paris</b>. Le site agrège l'ELO Faceit et le CS Rating Premier des
          membres, garde l'historique et affiche la progression : classement, profils, courbes et stats par
          match.
        </Section>

        <Section icon={TbShieldCheck} title="Les règles">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Un seul compte Faceit par personne - pas de smurf (Faceit l'interdit de toute façon).</li>
            <li>
              Le classement se base sur l'ELO Faceit et le CS Rating Premier, mis à jour automatiquement.
            </li>
            <li>Fair-play : le site est là pour se comparer et se charrier, pas pour se prendre la tête.</li>
          </ul>
        </Section>

        <Section icon={TbUserPlus} title="Rejoindre le classement">
          <p>
            Tu joues au pôle CS2 de 4eSport et tu veux apparaître ? Inscris-toi directement avec ton compte
            Discord et ton pseudo Faceit - ton ELO arrive à la prochaine synchro.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-[#060a18] transition-colors hover:bg-brand-hi"
            >
              <TbUserPlus size={16} /> S'inscrire
            </Link>
            <a
              href="https://discord.gg/gEVQtdCv6N"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.12] px-4 py-2 text-sm font-semibold text-ink-dim transition-colors hover:text-ink"
            >
              <TbBrandDiscord size={16} /> Le Discord
            </a>
          </div>
        </Section>
      </div>
    </div>
  );
}
