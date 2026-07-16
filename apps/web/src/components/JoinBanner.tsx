import { Link } from "react-router-dom";
import { TbArrowRight, TbBrandDiscord, TbUserPlus } from "react-icons/tb";
import { Card } from "../ui";

/** Bannière pleine largeur « Rejoindre le pôle » : inscription self-service (Discord + pseudo Faceit). */
export function JoinBanner() {
  return (
    <Card
      accent
      className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
    >
      <div>
        <div className="text-lg font-bold">Tu joues au pôle CS2 de 4eSport ?</div>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          Inscris-toi avec ton compte Discord et ton pseudo Faceit : tu apparais au classement à la prochaine
          synchro.
        </p>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
        <Link
          to="/register"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbUserPlus size={18} />
          S'inscrire
          <TbArrowRight size={16} />
        </Link>
        <a
          href="https://discord.gg/gEVQtdCv6N"
          target="_blank"
          rel="noreferrer"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-ink-dim transition-colors hover:border-brand hover:text-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbBrandDiscord size={18} />
          Discord
        </a>
      </div>
    </Card>
  );
}
