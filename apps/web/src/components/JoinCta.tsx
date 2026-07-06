import { TbBrandDiscord } from "react-icons/tb";
import { Card } from "../ui";

/** CTA « Rejoindre le pôle » : accroche + bouton Discord. */
export function JoinCta() {
  return (
    <Card accent className="flex flex-col gap-3 p-5">
      <div>
        <div className="text-sm font-bold">Tu joues au pôle CS2 ?</div>
        <p className="mt-1 text-xs text-ink-dim">
          Donne ton pseudo Faceit à un admin sur le Discord et apparais au classement.
        </p>
      </div>
      <a
        href="https://discord.gg/gEVQtdCv6N"
        target="_blank"
        rel="noreferrer"
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <TbBrandDiscord size={18} />
        Rejoindre le Discord
      </a>
    </Card>
  );
}
