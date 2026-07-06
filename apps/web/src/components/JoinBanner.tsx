import { TbBrandDiscord } from "react-icons/tb";
import { Card } from "../ui";

/** Bannière pleine largeur « Rejoindre le pôle » (CTA Discord). */
export function JoinBanner() {
  return (
    <Card
      accent
      className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
    >
      <div>
        <div className="text-lg font-bold">Tu joues au pôle CS2 de 4eSport ?</div>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          Donne ton pseudo Faceit à un admin sur le Discord et apparais au classement du pôle.
        </p>
      </div>
      <a
        href="https://discord.gg/gEVQtdCv6N"
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 sm:w-auto"
      >
        <TbBrandDiscord size={20} />
        Rejoindre le Discord
      </a>
    </Card>
  );
}
