import { Link } from "react-router-dom";
import { TbArrowRight } from "react-icons/tb";
import { Card } from "../ui";
import { Logo } from "../brand";
import ancient from "../assets/hero/ancient.png";

/** Hero cinématique du home : fond CS (de_Ancient), identité + punchline + CTA (variante bas-gauche épurée). */
export function HomeHero() {
  return (
    <Card className="relative overflow-hidden p-0">
      <img
        src={ancient}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/15" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/40 to-transparent" />
      <div className="absolute inset-0 bg-brand/5 mix-blend-overlay" />

      <div className="relative flex min-h-[300px] flex-col justify-end gap-5 p-6 sm:min-h-[380px] sm:p-10">
        <div>
          <Logo title="Retake" className="h-12 w-auto text-ink sm:h-16" />
          <p className="mt-3 max-w-lg text-sm text-ink-dim sm:text-base">
            Le classement du pôle CS2 de <b className="text-ink">4eSport</b> · Efrei Paris - en direct.
          </p>
        </div>

        <Link
          to="/classement"
          className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          Voir le classement <TbArrowRight size={16} />
        </Link>
      </div>
    </Card>
  );
}
