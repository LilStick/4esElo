import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { TbAlertTriangle, TbArrowRight, TbBrandDiscord, TbSearch, TbUserPlus } from "react-icons/tb";
import type { RegisterLookupResponse } from "@4eselo/types";
import { ApiError, loginUrl, register, registerLookup } from "../lib/api";
import { useMe } from "../lib/useMe";
import { Avatar, Button, Card, LevelBadge, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { useTitle } from "../lib/useTitle";

const FORMATIONS = ["Prépa intégrée", "Bachelor", "Ingénieur / Mastère", "Mastère Spécialisé", "Alternance"];

const YEAR = new Date().getUTCFullYear();
const START_YEARS = Array.from({ length: 8 }, (_, i) => YEAR + 1 - i); // récent → ancien
const END_YEARS = Array.from({ length: 9 }, (_, i) => YEAR + 4 - i);

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-loss">
      <TbAlertTriangle size={16} className="shrink-0" />
      {children}
    </p>
  );
}

export function Register() {
  useTitle("Inscription");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLoading, isAuthenticated, player } = useMe();

  const [nickname, setNickname] = useState("");
  const [lookup, setLookup] = useState<RegisterLookupResponse | null>(null);
  const [formation, setFormation] = useState(FORMATIONS[2]!);
  const [promoStart, setPromoStart] = useState(YEAR);
  const [promoEnd, setPromoEnd] = useState(YEAR + 2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Gardes d'état ---
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-4 h-11 w-full rounded-xl" />
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand/12 text-brand">
          <TbUserPlus size={28} />
        </span>
        <div>
          <h1 className="text-xl font-bold">Rejoins le classement du pôle</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-dim">
            Connecte-toi avec Discord (tu dois être sur le serveur 4eSport), puis renseigne ton pseudo Faceit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (window.location.href = loginUrl())}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-[#060a18] transition-colors hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbBrandDiscord size={18} />
          Se connecter avec Discord
        </button>
      </Card>
    );
  }

  if (player) {
    return (
      <EmptyState icon={TbUserPlus} title="Tu es déjà inscrit">
        Ton compte est relié au pôle.{" "}
        <button
          type="button"
          onClick={() => navigate(`/player/${player.id}`)}
          className="font-semibold text-brand-hi hover:underline"
        >
          Voir ton profil
        </button>
      </EmptyState>
    );
  }

  // --- Étape 1 : lookup ---
  const submitLookup = async () => {
    const nick = nickname.trim();
    if (!nick) return;
    setBusy(true);
    setError(null);
    try {
      const found = await registerLookup(nick);
      if (found.alreadyClaimed) {
        setError("Ce compte Faceit est déjà relié à un membre.");
        setLookup(null);
      } else {
        setLookup(found);
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "Pseudo Faceit introuvable - vérifie l'orthographe exacte."
          : "Impossible de vérifier ce pseudo pour l'instant.",
      );
      setLookup(null);
    } finally {
      setBusy(false);
    }
  };

  // --- Étape 2 : confirmation + inscription ---
  const doRegister = async () => {
    if (!lookup) return;
    setBusy(true);
    setError(null);
    try {
      const res = await register({
        faceitNickname: lookup.nickname,
        formation,
        promoStart,
        promoEnd,
      });
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["leaderboard"] });
      navigate(`/player/${res.player.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'inscription a échoué, réessaie dans un instant.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inscription au pôle</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Relie ton compte Discord à ton pseudo Faceit - tu apparaîtras au classement.
        </p>
      </div>

      {/* Étape 1 - pseudo Faceit */}
      <Card className="flex flex-col gap-4 p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitLookup();
          }}
          className="flex flex-col gap-3"
        >
          <label className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
            Ton pseudo Faceit
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <TbSearch
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
                size={16}
              />
              <input
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setLookup(null);
                  setError(null);
                }}
                placeholder="ex. s1mple"
                autoFocus
                className="w-full rounded-xl border border-white/[0.09] bg-white/[0.02] py-2.5 pr-3 pl-9 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand/60"
              />
            </div>
            <Button type="submit" disabled={busy || !nickname.trim()}>
              {busy && !lookup ? "…" : "Vérifier"}
            </Button>
          </div>
        </form>

        {error && <ErrorLine>{error}</ErrorLine>}

        {/* Prévisualisation Faceit */}
        {lookup && (
          <div className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            {lookup.avatar ? (
              <img
                src={lookup.avatar}
                alt=""
                className="size-14 shrink-0 rounded-xl object-cover"
                onError={(ev) => (ev.currentTarget.style.display = "none")}
              />
            ) : (
              <Avatar name={lookup.nickname} size={56} />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold">{lookup.nickname}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-ink-dim">
                <LevelBadge level={lookup.level} size={20} />
                <span className="font-mono font-bold text-brand tabular-nums">{lookup.elo ?? "-"}</span>
                <span className="text-ink-faint">ELO</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Étape 2 - promo + confirmation (une fois le pseudo validé) */}
      {lookup && (
        <Card className="flex flex-col gap-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
                Formation EFREI
              </span>
              <input
                list="formations"
                value={formation}
                onChange={(e) => setFormation(e.target.value)}
                className="w-full rounded-xl border border-white/[0.09] bg-white/[0.02] px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand/60"
              />
              <datalist id="formations">
                {FORMATIONS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
                Début de promo
              </span>
              <select
                value={promoStart}
                onChange={(e) => setPromoStart(Number(e.target.value))}
                className="w-full rounded-xl border border-white/[0.09] bg-white/[0.02] px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/60"
              >
                {START_YEARS.map((y) => (
                  <option key={y} value={y} className="bg-bg">
                    {y}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
                Fin de promo
              </span>
              <select
                value={promoEnd}
                onChange={(e) => setPromoEnd(Number(e.target.value))}
                className="w-full rounded-xl border border-white/[0.09] bg-white/[0.02] px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/60"
              >
                {END_YEARS.map((y) => (
                  <option key={y} value={y} className="bg-bg">
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {promoEnd < promoStart && <ErrorLine>La fin de promo doit être après le début.</ErrorLine>}

          <Button
            icon={TbArrowRight}
            onClick={doRegister}
            disabled={busy || promoEnd < promoStart}
            className="self-start"
          >
            {busy ? "Inscription…" : "Confirmer mon inscription"}
          </Button>
        </Card>
      )}
    </div>
  );
}
