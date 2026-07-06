import { TbBrandDiscord, TbBrandInstagram, TbBrandX, TbWorld } from "react-icons/tb";
import type { IconType } from "react-icons";

const SOCIALS: { href: string; label: string; icon: IconType }[] = [
  { href: "https://discord.com/invite/4eSport", label: "Discord", icon: TbBrandDiscord },
  { href: "https://www.instagram.com/4esport_efrei/", label: "Instagram", icon: TbBrandInstagram },
  { href: "https://twitter.com/4esport_efrei", label: "Twitter / X", icon: TbBrandX },
  { href: "https://4esport.fr", label: "Site 4eSport", icon: TbWorld },
];

const credit = "text-ink-dim underline-offset-2 transition-colors hover:text-brand-hi hover:underline";

/** Pied de page global : crédits (gauche) + réseaux de l'asso (droite), discret. */
export function Footer() {
  return (
    <footer className="mt-10 flex flex-col-reverse items-center gap-4 border-t border-white/[0.06] pt-6 text-xs text-ink-faint sm:flex-row sm:justify-between">
      <div>
        Fait par{" "}
        <a href="https://github.com/LilStick" target="_blank" rel="noreferrer" className={credit}>
          LilStick
        </a>{" "}
        &{" "}
        <a href="https://github.com/luminescencedev" target="_blank" rel="noreferrer" className={credit}>
          luminescence
        </a>
      </div>
      <div className="flex items-center gap-1">
        {SOCIALS.map((s) => (
          <a
            key={s.href}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            aria-label={s.label}
            title={s.label}
            className="grid size-9 place-items-center rounded-lg text-ink-dim transition-colors hover:bg-white/[0.05] hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <s.icon size={18} />
          </a>
        ))}
      </div>
    </footer>
  );
}
