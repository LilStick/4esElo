import { Link } from "react-router-dom";
import { TbArrowRight, TbConfetti, TbUser, TbUserPlus } from "react-icons/tb";
import { Card } from "../ui";
import { useMe } from "../lib/useMe";
import { currentPeriod } from "../lib/period";
import { JoinBanner } from "./JoinBanner";

/**
 * Bannière compte sur le home (B17.3), variable selon la session :
 * anonyme → invite à rejoindre ; connecté sans fiche → finir l'inscription ;
 * membre → accès direct à SON Wrapped + son profil.
 */
export function HomeAccountBanner() {
  const { isLoading, isAuthenticated, player, displayName } = useMe();

  if (isLoading || !isAuthenticated) return <JoinBanner />;

  // Connecté, pas encore de fiche → finir l'inscription.
  if (!player) {
    return (
      <Card
        accent
        className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div>
          <div className="text-lg font-bold">Plus qu'une étape, {displayName ?? "toi"} !</div>
          <p className="mt-1 max-w-xl text-sm text-ink-dim">
            Renseigne ton pseudo Faceit pour apparaître au classement du pôle.
          </p>
        </div>
        <Link
          to="/register"
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 sm:w-auto"
        >
          <TbUserPlus size={18} />
          Finir l'inscription
        </Link>
      </Card>
    );
  }

  // Membre connecté → raccourcis perso.
  const name = displayName ?? "toi";
  return (
    <Card
      accent
      className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
    >
      <div>
        <div className="text-lg font-bold">Content de te revoir, {name} 👋</div>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          Ton récap du mois t'attend — et ton profil suit ta progression.
        </p>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
        <Link
          to={`/wrapped/${currentPeriod()}/${player.id}`}
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbConfetti size={18} />
          Voir ton Wrapped
          <TbArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
        <Link
          to={`/player/${player.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.16] bg-white/[0.045] px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbUser size={18} />
          Ton profil
        </Link>
      </div>
    </Card>
  );
}
