import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TbAlertTriangle,
  TbBan,
  TbChevronDown,
  TbConfetti,
  TbLock,
  TbShieldCheck,
  TbSpeakerphone,
  TbTrash,
  TbUsers,
} from "react-icons/tb";
import type { Announcement, LeaderboardEntry } from "@4eselo/types";
import {
  adminBan,
  adminDeleteAnnouncement,
  adminDeletePlayer,
  adminPutAnnouncement,
  adminRegenerateWrapped,
  adminUnban,
  adminUpdatePlayer,
  getAnnouncements,
  getBans,
  getLeaderboard,
} from "../lib/api";
import { useMe } from "../lib/useMe";
import { discordAvatarUrl } from "../lib/discord";
import { currentPeriod, parsePeriod } from "../lib/period";
import { promoLabel } from "../lib/promo";
import { fullDate } from "../lib/relativeTime";
import { Avatar, Button, Card, Modal, Skeleton } from "../ui";
import { EmptyState } from "../components/EmptyState";
import { useTitle } from "../lib/useTitle";
import { cn } from "../lib/cn";

const nameOf = (e: LeaderboardEntry) => e.faceitNickname ?? e.discordName ?? "-";

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
              <option value={0}>-</option>
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
              <option value={0}>-</option>
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
    onSuccess: (r) => setMsg(`Wrapped régénéré - ${r.awards.length} award(s) publié(s) ✓`),
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

/** Dropdown custom de sélection d'un membre (avatars + hover), au lieu du `<select>` natif. */
function PlayerPicker({
  players,
  value,
  onChange,
}: {
  players: LeaderboardEntry[];
  value: string;
  onChange: (discordId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = players.find((p) => p.discordId === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${fieldClass} flex cursor-pointer items-center justify-between gap-2`}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar
              name={nameOf(selected)}
              size={22}
              src={discordAvatarUrl(selected.discordId, selected.discordAvatar)}
            />
            <span className="truncate">{nameOf(selected)}</span>
          </span>
        ) : (
          <span className="text-ink-faint">- choisir un membre -</span>
        )}
        <TbChevronDown size={16} className="shrink-0 text-ink-faint" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-white/[0.1] bg-surface-2 p-1 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
          {players.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-faint">Aucun membre à bannir.</div>
          ) : (
            players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.discordId!);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-white/[0.05]"
              >
                <Avatar name={nameOf(p)} size={26} src={discordAvatarUrl(p.discordId, p.discordAvatar)} />
                <span className="truncate font-medium">{nameOf(p)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Modération : bannir un membre (raison + confirmation) et débannir. */
function BansSection({ players }: { players: LeaderboardEntry[] }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["bans"], queryFn: getBans });
  const bans = data?.bans ?? [];
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmBan, setConfirmBan] = useState(false);
  const [unbanId, setUnbanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bannedSet = new Set(bans.map((b) => b.discordId));
  const banneable = players.filter((p) => p.discordId && !bannedSet.has(p.discordId));
  const nameByDiscord = (did: string) => {
    const p = players.find((x) => x.discordId === did);
    return p ? nameOf(p) : did;
  };

  const ban = useMutation({
    mutationFn: () => adminBan(targetId, reason.trim() || null),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["bans"] });
      setConfirmBan(false);
      setTargetId("");
      setReason("");
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Échec du ban"),
  });
  const unban = useMutation({
    mutationFn: (did: string) => adminUnban(did),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["bans"] });
      setUnbanId(null);
    },
  });

  return (
    <Card className="flex flex-col gap-5 p-5">
      {/* Bloc : bannir un membre */}
      <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <span className={labelClass}>Bannir un membre</span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs text-ink-faint">Membre</span>
            <PlayerPicker players={banneable} value={targetId} onChange={setTargetId} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs text-ink-faint">Raison (optionnel)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. comportement toxique"
              className={fieldClass}
            />
          </label>
          <Button
            icon={TbBan}
            onClick={() => setConfirmBan(true)}
            disabled={!targetId}
            className="bg-loss text-white hover:bg-loss disabled:opacity-50"
          >
            Bannir
          </Button>
        </div>
      </div>

      {/* Bloc : comptes bannis */}
      <div className="flex flex-col gap-2">
        <span className={labelClass}>Comptes bannis ({bans.length})</span>
        {bans.length === 0 ? (
          <p className="text-sm text-ink-dim">Aucun compte banni pour l'instant.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.05]">
            {bans.map((b) => (
              <div key={b.discordId} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-loss/12 text-loss">
                  <TbBan size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{nameByDiscord(b.discordId)}</div>
                  <div className="truncate text-xs text-ink-faint">
                    {b.reason ?? "Sans raison"} · {fullDate(b.createdAt)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setUnbanId(b.discordId)}
                  className="px-3 py-1.5 text-xs"
                >
                  Débannir
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={confirmBan} onClose={() => setConfirmBan(false)} title="Bannir ce compte">
        <div className="flex flex-col gap-4 p-3">
          <p className="text-sm text-ink-dim">
            Bannir <span className="font-bold text-ink">{nameByDiscord(targetId)}</span> le déconnecte et
            l'empêche de se reconnecter
            {reason.trim() ? ` - raison : « ${reason.trim()} »` : ""}.
          </p>
          {error && (
            <p className="flex items-center gap-2 text-sm text-loss">
              <TbAlertTriangle size={16} /> {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmBan(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => ban.mutate()}
              disabled={ban.isPending}
              className="bg-loss text-white hover:bg-loss"
            >
              {ban.isPending ? "…" : "Bannir"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={unbanId !== null} onClose={() => setUnbanId(null)} title="Débannir ce compte">
        <div className="flex flex-col gap-4 p-3">
          <p className="text-sm text-ink-dim">
            Débannir <span className="font-bold text-ink">{unbanId ? nameByDiscord(unbanId) : ""}</span> ? Il
            pourra se reconnecter.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUnbanId(null)}>
              Annuler
            </Button>
            <Button onClick={() => unbanId && unban.mutate(unbanId)} disabled={unban.isPending}>
              {unban.isPending ? "…" : "Débannir"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/** Onglet Admins : visualisation seule (front). La liste complète et l'ajout/retrait
 *  d'admins dépendent du back (rôles en base, ticket #388) — pas faisable côté front. */
function AdminsSection() {
  const { displayName, avatarUrl } = useMe();
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-3 p-4">
        <Avatar name={displayName ?? "Admin"} size={40} src={avatarUrl ?? undefined} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{displayName ?? "Toi"}</div>
          <div className="text-xs text-ink-faint">Connecté en tant qu'admin</div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand-hi">
          <TbShieldCheck size={13} /> Admin
        </span>
      </Card>
      <Card className="flex items-start gap-3 p-4 text-sm text-ink-dim">
        <TbAlertTriangle size={18} className="mt-0.5 shrink-0 text-ink-faint" />
        <p>
          La liste complète des admins et l'ajout/retrait se feront ici une fois le back prêt (gestion des
          rôles en base). Pour l'instant, les admins sont définis côté serveur.
        </p>
      </Card>
    </div>
  );
}

const TABS = [
  { id: "joueurs", label: "Joueurs", icon: TbUsers },
  { id: "admins", label: "Admins", icon: TbShieldCheck },
  { id: "moderation", label: "Modération", icon: TbBan },
  { id: "annonces", label: "Annonces", icon: TbSpeakerphone },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function Admin() {
  useTitle("Admin");
  const navigate = useNavigate();
  const { isLoading: meLoading, isAdmin } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = TABS.find((t) => t.id === searchParams.get("tab"))?.id ?? "joueurs";

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panel admin</h1>
        <p className="mt-1 text-sm text-ink-dim">Joueurs, admins, modération et annonces du pôle.</p>
      </div>

      {/* Onglets (état dans l'URL ?tab= → deep-linkable, conservé au refresh) */}
      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
        {TABS.map((t) => {
          const isActive = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSearchParams({ tab: t.id })}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
                isActive ? "bg-brand/15 text-brand-hi" : "text-ink-dim hover:text-ink",
              )}
            >
              <t.icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "joueurs" && (
        <Section icon={TbUsers} title={`Joueurs (${players.length})`}>
          <Card className="flex flex-col divide-y divide-white/[0.05] p-[var(--bezel)]">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-2 py-2.5">
                <Avatar name={nameOf(p)} size={34} src={discordAvatarUrl(p.discordId, p.discordAvatar)} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{nameOf(p)}</div>
                  <div className="truncate text-xs text-ink-faint">
                    {p.formation ?? "-"}
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
      )}

      {tab === "admins" && (
        <Section icon={TbShieldCheck} title="Admins">
          <AdminsSection />
        </Section>
      )}

      {tab === "moderation" && (
        <Section icon={TbBan} title="Modération - bans">
          <BansSection players={players} />
        </Section>
      )}

      {tab === "annonces" && (
        <div className="flex flex-col gap-8">
          <Section icon={TbSpeakerphone} title="Annonce staff (home)">
            <AnnouncementEditor current={staff} />
          </Section>
          <Section icon={TbConfetti} title="Régénérer un Wrapped">
            <WrappedRegen />
          </Section>
        </div>
      )}

      {editing && <EditPlayerModal entry={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeletePlayerModal entry={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
