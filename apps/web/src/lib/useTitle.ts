import { useEffect } from "react";

/** Met à jour le <title> de l'onglet. Suffixe la marque automatiquement. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Retake`;
  }, [title]);
}
