import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { TbFlame } from "react-icons/tb";
import { getPlayerRoast } from "../lib/api";
import { Card, Skeleton } from "../ui";
import { EmptyState } from "./EmptyState";
import poulet from "../assets/poulet.webp";

/** En-tête « 4esBot » : le poulet de CS en mascotte (léger dandinement au survol). */
function BotHeader() {
  return (
    <div className="relative flex items-center gap-3">
      <motion.img
        src={poulet}
        alt=""
        aria-hidden
        className="size-14 shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]"
        whileHover={{ rotate: [0, -6, 6, -3, 0], transition: { duration: 0.5 } }}
      />
      <div>
        <div className="font-bold">4esBot</div>
        <div className="text-xs text-ink-dim">Diagnostic récent</div>
      </div>
    </div>
  );
}

/**
 * Encart roast du profil (B7.7) - variante « 4esBot » : la mascotte analyse les
 * dernières games et balance ses punchlines (négatif + positif) au clic, avec un
 * effet de frappe façon IA, mais 100 % déterministe (données de `GET /players/:id/roast`).
 */
export function ProfileRoast({ id }: { id: string }) {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["roast", id], queryFn: () => getPlayerRoast(id) });

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-9 w-44" />
      </Card>
    );
  }

  const lines = data?.lines ?? [];
  const forecast = data?.forecast ?? null;

  if (lines.length === 0) {
    return (
      <Card className="py-2">
        <EmptyState icon={TbFlame} title="Pas encore de diagnostic">
          Le 4esBot a besoin de quelques games de plus pour te chambrer.
        </EmptyState>
      </Card>
    );
  }

  if (!revealed) {
    return (
      <Card className="relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 h-48 w-64 rounded-full bg-brand/10 blur-3xl"
        />
        <button
          onClick={() => setRevealed(true)}
          className="group relative flex w-full cursor-pointer flex-col items-center gap-3 py-2 focus-visible:outline-none"
        >
          <motion.img
            src={poulet}
            alt=""
            aria-hidden
            className="size-24 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]"
            whileHover={{ rotate: [0, -6, 6, -3, 0], transition: { duration: 0.5 } }}
          />
          <span className="text-sm font-semibold text-brand transition-colors group-hover:text-brand-hi">
            Lancer l'analyse
          </span>
        </button>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-0 h-48 w-64 rounded-full bg-brand/10 blur-3xl"
      />
      <BotHeader />
      <div className="relative mt-4 flex flex-col gap-2.5">
        {lines.map((l, i) => (
          <motion.div
            key={l.label}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.5, duration: 0.3, ease: "easeOut" }}
            className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <span className="text-xl leading-none">{l.emoji}</span>
            <div className="min-w-0">
              <div className="text-sm font-bold">{l.label}</div>
              <div className="text-sm text-ink-dim">{l.text}</div>
            </div>
          </motion.div>
        ))}
        {forecast && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: lines.length * 0.5, duration: 0.3, ease: "easeOut" }}
            className="mt-1 flex items-baseline gap-2 text-sm text-ink-dim"
          >
            <span className="text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
              Prévision
            </span>
            <span>{forecast.text}</span>
          </motion.div>
        )}
      </div>
    </Card>
  );
}
