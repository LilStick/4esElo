import type { ReactNode } from "react";
import type { IconType } from "react-icons";

/** État vide / erreur soigné : icône encerclée, titre, texte, action optionnelle. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: IconType;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-ink-faint">
        <Icon size={26} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {children && <p className="mx-auto max-w-[42ch] text-sm text-ink-dim">{children}</p>}
      </div>
      {action}
    </div>
  );
}
