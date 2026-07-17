import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TbAlertTriangle, TbCheck, TbChevronDown, TbExternalLink } from "react-icons/tb";
import { ApiError, getPremierStatus, premierConnect, premierDisconnect } from "../lib/api";
import { fullDate } from "../lib/relativeTime";
import { Button, Skeleton } from "../ui";

// Formats attendus par le back (mêmes regex que /premier/connect).
const AUTH_RE = /^[A-Za-z0-9-]{5,40}$/;
const SHARE_RE = /^CSGO(-[A-Za-z0-9]{5}){5}$/;

const fieldClass =
  "w-full rounded-xl border border-white/[0.09] bg-white/[0.02] px-3 py-2.5 font-mono text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand/60";
const labelClass = "text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase";

function mapError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 404) return "Inscris-toi d'abord avec ton compte Faceit, puis reviens lier Premier.";
    if (e.status === 400) return "Codes invalides — vérifie le format (voir le guide ci-dessous).";
    if (e.status === 503)
      return e.message.includes("configured")
        ? "Premier n'est pas encore configuré côté serveur."
        : "Le mode Premier est désactivé pour le moment.";
    return e.message;
  }
  return "Échec — réessaie dans un instant.";
}

/** Guide « comment obtenir mes codes » (repliable). */
function CodesGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-semibold text-ink-dim transition-colors hover:text-ink"
      >
        Comment obtenir mes codes ?
        <TbChevronDown
          size={16}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-3.5 py-3 text-sm text-ink-dim">
          <div>
            <div className="font-semibold text-ink">Game auth code</div>
            <p className="mt-0.5">
              Ton code d'authentification de l'historique CS2. Récupère-le sur{" "}
              <a
                href="https://help.steampowered.com/fr/wizard/HelpWithGameIssue/?appid=730&issueid=128"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand-hi hover:underline"
              >
                Steam (aide CS2) <TbExternalLink size={12} />
              </a>{" "}
              — format <span className="font-mono text-ink">XXXX-XXXXX-XXXX</span>.
            </p>
          </div>
          <div>
            <div className="font-semibold text-ink">Share code</div>
            <p className="mt-0.5">
              Le code de partage d'une <b className="text-ink">partie Premier récente</b> (dans CS2 :
              historique → « partager »). Format{" "}
              <span className="font-mono text-ink">CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Onboarding Premier (B18.6) : lier son compte via game auth code + share code Steam.
 * Statut de connexion, connexion/déconnexion, guide, gestion des erreurs back.
 * Prérequis : être inscrit (compte Faceit) — sinon le back renvoie 404.
 */
export function PremierConnect() {
  const qc = useQueryClient();
  const {
    data: status,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["premier-status"],
    queryFn: getPremierStatus,
  });

  const [auth, setAuth] = useState("");
  const [share, setShare] = useState("");
  const [error, setError] = useState<string | null>(null);

  const authOk = AUTH_RE.test(auth.trim());
  const shareOk = SHARE_RE.test(share.trim());

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["premier-status"] });
    await qc.invalidateQueries({ queryKey: ["premier-enabled"] });
  };

  const connect = useMutation({
    mutationFn: () => premierConnect({ steamAuthCode: auth.trim(), shareCode: share.trim() }),
    onSuccess: async () => {
      await invalidate();
      setAuth("");
      setShare("");
      setError(null);
    },
    onError: (e) => setError(mapError(e)),
  });
  const disconnect = useMutation({ mutationFn: premierDisconnect, onSuccess: invalidate });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (isError) return <p className="text-sm text-loss">Statut Premier indisponible pour le moment.</p>;

  // Déjà connecté → état + déconnexion.
  if (status?.connected) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-win/25 bg-win/[0.08] p-4">
          <TbCheck size={18} className="mt-0.5 shrink-0 text-win" />
          <div className="text-sm">
            <div className="font-semibold text-ink">Compte Premier lié ✓</div>
            <p className="mt-0.5 text-ink-dim">
              {status.syncedAt
                ? `Dernière synchro : ${fullDate(status.syncedAt)}.`
                : "En attente de la 1re synchro — ton CS Rating apparaît après quelques parties Premier."}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
          className="self-start"
        >
          {disconnect.isPending ? "…" : "Délier Premier"}
        </Button>
      </div>
    );
  }

  // Non connecté → formulaire.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (authOk && shareOk) connect.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-ink-dim">
        Lie ton compte pour suivre ton <b className="text-ink">CS Rating Premier</b> dans le classement. Tes
        codes Steam sont chiffrés côté serveur.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Game auth code</span>
        <input
          value={auth}
          onChange={(e) => {
            setAuth(e.target.value);
            setError(null);
          }}
          placeholder="XXXX-XXXXX-XXXX"
          className={fieldClass}
        />
        {auth.trim() !== "" && !authOk && (
          <span className="text-xs text-loss">
            Format attendu : 5 à 40 caractères (lettres, chiffres, tirets).
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Share code (partie Premier récente)</span>
        <input
          value={share}
          onChange={(e) => {
            setShare(e.target.value);
            setError(null);
          }}
          placeholder="CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
          className={fieldClass}
        />
        {share.trim() !== "" && !shareOk && (
          <span className="text-xs text-loss">Format attendu : CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx.</span>
        )}
      </label>

      <CodesGuide />

      {error && (
        <p className="flex items-center gap-2 text-sm text-loss">
          <TbAlertTriangle size={16} className="shrink-0" /> {error}
        </p>
      )}

      <Button type="submit" disabled={!authOk || !shareOk || connect.isPending} className="self-start">
        {connect.isPending ? "Connexion…" : "Lier mon compte Premier"}
      </Button>
    </form>
  );
}
