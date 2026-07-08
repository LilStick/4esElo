import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TbAlertTriangle, TbConfetti, TbLock, TbSpeakerphone, TbTrash, TbUsers } from "react-icons/tb";
import type { Announcement, LeaderboardEntry } from "@4eselo/types";
import {
  adminDeleteAnnouncement,
  adminDeletePlayer,
  adminPutAnnouncement,
  adminRegenerateWrapped,
  adminUpdatePlayer,
  getAnnouncements,
  getLeaderboard,
} from "../lib/api";
import { useMe } from "../lib/useMe";
import { discordAvatarUrl } from "../lib/discord";
import { currentPeriod, parsePeriod } from "../lib/period";
import { promoLabel } from "../lib/promo";
import { Avatar, Button, Card, Modal, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { useTitle } from "../lib/useTitle";

const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "—";

const YEAR = new Date().getUTCFullYear();
const YEARS = Array.from({ length: 9 }, (_, i) => YEAR + 2 - i);

const fieldClass =
  "w-full rounded-xl border border-white/[0.09] bg-white/[0.02] px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand/60";
const labelClass = "text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase";

/** Titre de section. */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof TbUsers;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-ink-faint uppercase">
        <Icon size={14} className="text-brand" />
        {title}
      </div>
      {children}
    </section>
  );
}

/** Modale d'édition d'un joueur (pseudo Discord, formation, promo). */
function EditPlayerModal({ entry, onClose }: { entry: LeaderboardEntry; onClose: () => void }) {
  const qc = useQueryClient();
  const [discordName, setDiscordName] = useState(entry.discordName ?? "");
  const [formation, setFormation] = useState(entry.formation ?? "");
  const [promoStart, setPromoStart] = useState(entry.promoStart ?? 0);
  const [promoEnd, setPromoEnd] = useState(entry.promoEnd ?? 0);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      adminUpdatePlayer(entry.id, {
        discordName: discordName.trim() || null,
        formation: formation.trim() || null,
        promoStart: promoStart || null,
        promoEnd: promoEnd || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leaderboard"] });
      await qc.invalidateQueries({ queryKey: ["player", entry.id] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Échec de l'enregistrement"),
  });

  return (
    <Modal open onClose={onClose} title={`Éditer ${nameOf(entry)}`}>
      <div className="flex flex-col gap-4 p-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Pseudo Discord</span>
          <input
            value={discordName}
            onChange={(e) => setDiscordName(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Formation</span>
          <input value={formation} onChange={(e) => setFormation(e.target.value)} className={fieldClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Début promo</span>
            <select
              value={promoStart}
              onChange={(e) => setPromoStart(Number(e.target.value))}
              className={fieldClass}
            >
              <option value={0}>—</option>
              {YEARS.map((y) => (
                <option key={y} value={y} className="bg-bg">
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Fin promo</span>
            <select
              value={promoEnd}
              onChange={(e) => setPromoEnd(Number(e.target.value))}
              className={fieldClass}
            >
              <option value={0}>—</option>
              {YEARS.map((y) => (
                <option key={y} value={y} className="bg-bg">
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p className="flex items-center gap-2 text-sm text-loss">
            <TbAlertTriangle size={16} /> {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Confirmation de suppression (cascade sur tout l'historique). */
function DeletePlayerModal({ entry, onClose }: { entry: LeaderboardEntry; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const del = useMutation({
    mutationFn: () => adminDeletePlayer(entry.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leaderboard"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Échec de la suppression"),
  });
  return (
    <Modal open onClose={onClose} title="Supprimer le joueur">
      <div className="flex flex-col gap-4 p-3">
        <p className="text-sm text-ink-dim">
          Supprimer <span className="font-bold text-ink">{nameOf(entry)}</span> efface aussi{" "}
          <span className="text-loss">tout son historique</span> (snapshots ELO, matchs). Irréversible.
        </p>
        {error && (
          <p className="flex items-center gap-2 text-sm text-loss">
            <TbAlertTriangle size={16} /> {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="bg-loss text-white hover:bg-loss"
          >
            {del.isPending ? "…" : "Supprimer définitivement"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Éditeur de l'annonce staff de la home. */
function AnnouncementEditor({ current }: { current: Announcement | undefined }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(current?.title ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [linkUrl, setLinkUrl] = useState(current?.linkUrl ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["announcements"] });

  const publish = useMutation({
    mutationFn: () =>
      adminPutAnnouncement({
        title: title.trim(),
        body: body.trim() || null,
        linkUrl: linkUrl.trim() || null,
      }),
    onSuccess: async () => {
      await invalidate();
      setMsg("Annonce publiée ✓");
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "Échec"),
  });
  const remove = useMutation({
    mutationFn: adminDeleteAnnouncement,
    onSuccess: async () => {
      await invalidate();
      setTitle("");
      setBody("");
      setLinkUrl("");
      setMsg("Annonce retirée ✓");
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "Échec"),
  });

  return (
    <Card className="flex flex-col gap-4 p-5">
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Titre</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex. Tournoi interne samedi 20h"
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Texte (optionnel)</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Lien (optionnel, ex. /wrapped/juin-2026)</span>
        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={fieldClass} />
      </label>
      {msg && <p className="text-sm text-ink-dim">{msg}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {current && (
          <Button variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
            Retirer l'annonce
          </Button>
        )}
        <Button onClick={() => publish.mutate()} disabled={publish.isPending || !title.trim()}>
          {publish.isPending ? "…" : current ? "Mettre à jour" : "Publier"}
        </Button>
      </div>
    </Card>
  );
}

/** Régénération d'un Wrapped mensuel. */
function WrappedRegen() {
  const now = parsePeriod(currentPeriod());
  const [year, setYear] = useState(now?.year ?? YEAR);
  const [month, setMonth] = useState(now?.month ?? 1);
  const [msg, setMsg] = useState<string | null>(null);
  const regen = useMutation({
    mutationFn: () => adminRegenerateWrapped(year, month),
    onSuccess: (r) => setMsg(`Wrapped régénéré — ${r.awards.length} award(s) publié(s) ✓`),
    onError: (e) => setMsg(e instanceof Error ? e.message : "Échec"),
  });
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Année</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Mois (1-12)</span>
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
      </div>
      {msg && <p className="text-sm text-ink-dim">{msg}</p>}
      <Button onClick={() => regen.mutate()} disabled={regen.isPending} className="self-start">
        {regen.isPending ? "…" : "Régénérer + annoncer"}
      </Button>
    </Card>
  );
}

export function Admin() {
  useTitle("Admin");
  const navigate = useNavigate();
  const { isLoading: meLoading, isAdmin } = useMe();

  const { data: board } = useQuery({
    queryKey: ["leaderboard", "faceit", "spark12"],
    queryFn: () => getLeaderboard("faceit", 12),
    enabled: isAdmin,
  });
  const { data: ann } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => getAnnouncements(5),
    enabled: isAdmin,
  });
  const staff = useMemo(() => ann?.announcements.find((a) => a.type === "staff"), [ann]);

  const [editing, setEditing] = useState<LeaderboardEntry | null>(null);
  const [deleting, setDeleting] = useState<LeaderboardEntry | null>(null);

  if (meLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={TbLock}
        title="Accès réservé"
        action={<Button onClick={() => navigate("/")}>Retour à l'accueil</Button>}
      >
        Cette page est réservée aux admins du pôle.
      </EmptyState>
    );
  }

  const players = board?.leaderboard ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panel admin</h1>
        <p className="mt-1 text-sm text-ink-dim">Gestion des joueurs, de l'annonce staff et des Wrapped.</p>
      </div>

      <Section icon={TbUsers} title={`Joueurs (${players.length})`}>
        <Card className="flex flex-col divide-y divide-white/[0.05] p-[var(--bezel)]">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-2 py-2.5">
              <Avatar name={nameOf(p)} size={34} src={discordAvatarUrl(p.discordId, p.discordAvatar)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{nameOf(p)}</div>
                <div className="truncate text-xs text-ink-faint">
                  {p.formation ?? "—"}
                  {promoLabel(p.promoStart, p.promoEnd) ? ` · ${promoLabel(p.promoStart, p.promoEnd)}` : ""}
                </div>
              </div>
              <Button variant="ghost" onClick={() => setEditing(p)} className="px-3 py-1.5 text-xs">
                Éditer
              </Button>
              <button
                onClick={() => setDeleting(p)}
                aria-label="Supprimer"
                title="Supprimer"
                className="grid size-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-loss/15 hover:text-loss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loss/60"
              >
                <TbTrash size={16} />
              </button>
            </div>
          ))}
        </Card>
      </Section>

      <Section icon={TbSpeakerphone} title="Annonce staff (home)">
        <AnnouncementEditor current={staff} />
      </Section>

      <Section icon={TbConfetti} title="Régénérer un Wrapped">
        <WrappedRegen />
      </Section>

      {editing && <EditPlayerModal entry={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeletePlayerModal entry={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
