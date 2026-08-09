import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { EloSource } from "@4eselo/types";
import { ELO_SOURCE_KEY, isEloSource, resolveSource } from "./eloSource";
import { usePremierEnabled } from "./usePremierEnabled";

function stored(): EloSource {
  try {
    const v = localStorage.getItem(ELO_SOURCE_KEY);
    return isEloSource(v) ? v : "faceit";
  } catch {
    return "faceit";
  }
}

/**
 * Source ELO courante (faceit | premier), partagée par toute l'app.
 * Priorité : `?source=` dans l'URL (partageable), sinon préférence localStorage,
 * **clampée sur Faceit quand Premier est off** (#479) → jamais d'UI figée en
 * Premier via un lien/localStorage quand le back a fermé la surface.
 * Le setter écrit les deux → cohérent entre pages + lien partageable. Défaut faceit.
 */
export function useEloSource(): [EloSource, (s: EloSource) => void] {
  const [params, setParams] = useSearchParams();
  const premierEnabled = usePremierEnabled();
  const source = resolveSource(params.get("source"), stored(), premierEnabled);

  const setSource = useCallback(
    (s: EloSource) => {
      try {
        localStorage.setItem(ELO_SOURCE_KEY, s);
      } catch {
        // pas de persistance possible (mode privé) → au moins l'URL porte l'état
      }
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (s === "faceit") next.delete("source");
          else next.set("source", s);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [source, setSource];
}
