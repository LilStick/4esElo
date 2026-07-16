import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TbBulb, TbBrandDiscord, TbSend } from "react-icons/tb";
import { ApiError, getIdeas, loginUrl, postIdea } from "../lib/api";
import { useMe } from "../lib/useMe";
import { Button, Card, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { relativeTime, fullDate } from "../lib/relativeTime";
import { useTitle } from "../lib/useTitle";
import { cn } from "../lib/cn";

const MAX = 500;

export function Ideas() {
  useTitle("Boîte à idées");
  const { isAuthenticated } = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  // Le fil est réservé aux membres (l'API exige la session).
  const { data, isLoading } = useQuery({
    queryKey: ["ideas"],
    queryFn: getIdeas,
    enabled: isAuthenticated,
  });

  const submit = useMutation({
    mutationFn: () => postIdea(text.trim()),
    onSuccess: async () => {
      setText("");
      setMsg({ text: "Idée envoyée, merci ! 💡", tone: "ok" });
      await qc.invalidateQueries({ queryKey: ["ideas"] });
    },
    onError: (e) => {
      const status = e instanceof ApiError ? e.status : 0;
      setMsg({
        text:
          status === 429
            ? "Limite de 3 idées par jour atteinte - reviens demain."
            : "Échec de l'envoi, réessaie.",
        tone: "warn",
      });
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TbBulb className="text-brand" size={24} /> Boîte à idées
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Une idée pour le site ? Propose-la - elle atterrit direct dans le salon dev.
        </p>
      </div>

      {isAuthenticated ? (
        <Card className="flex flex-col gap-3 p-5">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, MAX));
              setMsg(null);
            }}
            rows={3}
            placeholder="Ton idée en quelques mots…"
            className="w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brand focus-visible:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-ink-faint tabular-nums">
              {text.length}/{MAX}
            </span>
            <div className="flex items-center gap-3">
              {msg && (
                <span className={cn("text-xs font-semibold", msg.tone === "ok" ? "text-win" : "text-loss")}>
                  {msg.text}
                </span>
              )}
              <Button
                icon={TbSend}
                className="disabled:cursor-default disabled:opacity-50"
                disabled={!text.trim() || submit.isPending}
                onClick={() => submit.mutate()}
              >
                Envoyer
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-ink-dim">Connecte-toi avec Discord pour proposer une idée.</p>
          <Button icon={TbBrandDiscord} onClick={() => (window.location.href = loginUrl())}>
            Se connecter
          </Button>
        </Card>
      )}

      {!isAuthenticated ? null : isLoading ? (
        <Card className="flex flex-col gap-2 p-[var(--bezel)]">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="px-3 py-3">
              <Skeleton className="h-4 w-full max-w-[420px]" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          ))}
        </Card>
      ) : items.length === 0 ? (
        <EmptyState icon={TbBulb} title="Aucune idée pour l'instant">
          Sois le premier à en proposer une !
        </EmptyState>
      ) : (
        <Card className="flex flex-col divide-y divide-white/[0.05] p-[var(--bezel)]">
          {items.map((it) => (
            <div key={it.id} className="px-3 py-3">
              <p className="text-sm whitespace-pre-wrap text-ink">{it.text}</p>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-faint">
                <span className="font-semibold text-ink-dim">{it.author ?? "Anonyme"}</span>
                {it.mine && (
                  <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand-hi uppercase">
                    toi
                  </span>
                )}
                <span>·</span>
                <span title={fullDate(it.createdAt)}>{relativeTime(it.createdAt)}</span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
