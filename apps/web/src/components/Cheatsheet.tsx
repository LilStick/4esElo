import type { ReactNode } from "react";
import { TbRoute } from "react-icons/tb";
import { Modal } from "../ui";
import { replayTour } from "../lib/tour";

type Shortcut = { keys: string[]; sequence?: boolean; label: string };

/** Les raccourcis réellement câblés (voir AppShell) — à garder en phase. */
const SHORTCUTS: Shortcut[] = [
  { keys: ["Ctrl", "K"], label: "Recherche globale (⌘K sur Mac)" },
  { keys: ["G", "H"], sequence: true, label: "Aller à l'accueil" },
  { keys: ["G", "C"], sequence: true, label: "Aller au classement" },
  { keys: ["G", "A"], sequence: true, label: "Aller à l'asso" },
  { keys: ["?"], label: "Afficher cette aide" },
  { keys: ["Échap"], label: "Fermer une modale / annuler" },
];

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="grid min-w-[24px] place-items-center rounded-md border border-white/[0.12] bg-white/[0.05] px-1.5 py-1 font-mono text-[11px] font-semibold text-ink">
      {children}
    </kbd>
  );
}

/** Modale d'aide (B14.15) — ouverte par « ? », liste les raccourcis clavier. */
export function Cheatsheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Raccourcis clavier">
      <div className="flex flex-col">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5">
            <span className="text-sm text-ink-dim">{s.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {s.keys.map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 && <span className="text-[10px] text-ink-faint">{s.sequence ? "puis" : "+"}</span>}
                  <Kbd>{k}</Kbd>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="px-3 pt-2 pb-1 text-[11px] text-ink-faint">
        Les raccourcis sont inactifs quand tu écris dans un champ.
      </p>
      <div className="mt-1 border-t border-white/[0.06] px-3 pt-3">
        <button
          type="button"
          onClick={() => {
            onClose();
            replayTour();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <TbRoute size={16} />
          Revoir le tuto
        </button>
      </div>
    </Modal>
  );
}
