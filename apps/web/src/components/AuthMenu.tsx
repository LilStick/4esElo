import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { TbBrandDiscord, TbConfetti, TbLogout, TbShieldCog, TbUser, TbUserPlus } from "react-icons/tb";
import { Avatar } from "../ui";
import { loginUrl, logout } from "../lib/api";
import { useMe } from "../lib/useMe";
import { currentPeriod } from "../lib/period";
import { cn } from "../lib/cn";

/** Petit lien-action compact (icône) du bloc connecté. */
function IconAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof TbUser;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg text-ink-dim transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      <Icon size={17} />
    </button>
  );
}

/**
 * Bloc de session dans la sidebar (B17.3). Trois états : anonyme (bouton login
 * Discord), connecté sans fiche (inviter à finir l'inscription), connecté membre
 * (avatar + accès profil / son Wrapped / déconnexion).
 */
export function AuthMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { isLoading, isAuthenticated, player, displayName, isAdmin, avatarUrl } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const go = (to: string) => {
    onNavigate?.();
    navigate(to);
  };

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      // succès ou non, on repart d'un état propre côté client
      await qc.invalidateQueries({ queryKey: ["me"] });
      onNavigate?.();
      navigate("/");
    }
  };

  if (isLoading) {
    return <div className="mx-1 h-11 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => (window.location.href = loginUrl())}
        className="mx-1 flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <TbBrandDiscord size={18} />
        Se connecter
      </button>
    );
  }

  const name = displayName ?? "Moi";

  // Connecté mais pas encore de fiche joueur → finir l'inscription.
  if (!player) {
    return (
      <div className="mx-1 flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={name} size={30} src={avatarUrl} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
        </div>
        <button
          type="button"
          onClick={() => go("/register")}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbUserPlus size={15} />
          Finir l'inscription
        </button>
      </div>
    );
  }

  // Connecté + membre.
  return (
    <div className="mx-1 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 pl-2.5">
      <Avatar name={name} size={30} src={avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
          {isAdmin && (
            <span
              title="Admin"
              className={cn(
                "rounded px-1 py-0.5 text-[9px] font-bold tracking-wider text-brand-hi uppercase",
                "bg-brand/15",
              )}
            >
              admin
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center">
        <IconAction label="Mon profil" icon={TbUser} onClick={() => go(`/player/${player.id}`)} />
        <IconAction
          label="Mon Wrapped"
          icon={TbConfetti}
          onClick={() => go(`/wrapped/${currentPeriod()}/${player.id}`)}
        />
        {isAdmin && <IconAction label="Panel admin" icon={TbShieldCog} onClick={() => go("/admin")} />}
        <IconAction label="Se déconnecter" icon={TbLogout} onClick={onLogout} />
      </div>
    </div>
  );
}
