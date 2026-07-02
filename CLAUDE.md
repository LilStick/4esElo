# CLAUDE.md — 4esElo

Classement ELO des membres du pôle CS2 de l'asso. Site qui agrège des API externes
(Faceit d'abord, Premier ensuite), stocke un historique, et affiche un classement +
des pages joueur avec courbe d'ELO.

---

## ⚠️ RÈGLE N°1 — Preflight obligatoire avant toute action

**Au début de CHAQUE session, lance `pnpm preflight` et NE FAIS RIEN d'autre tant que tout
n'est pas ✓.** Si un check est ✗, corrige-le (ou demande à l'utilisateur) AVANT de coder,
lancer, ou tester quoi que ce soit. Ne suppose jamais que l'environnement est prêt.

```bash
pnpm preflight
```

Ça vérifie : Node ≥ 20, pnpm, **le daemon Docker**, les deps installées, `.env` présent
(+ `DATABASE_URL`, `FACEIT_API_KEY`), et **Postgres joignable**. Exit ≠ 0 = bloquant.

Si un check échoue, le script affiche la commande de correction. Rappels courants :

- **Docker down** → Windows : lance Docker Desktop (ou WSL2) · macOS : `colima start` · Linux : `sudo systemctl start docker`
- **Deps** → `pnpm install`
- **`.env` absent** → `cp .env.example .env` (Windows : `copy .env.example .env`)
- **Postgres down** → `pnpm db:up`

---

## ⚠️ RÈGLE N°2 — Toujours partir d'un `main` à jour

**Au début de CHAQUE session** et **avant de créer/switcher une branche** :

```bash
git fetch origin
git switch main && git pull --ff-only     # récupérer le dernier main
git switch -c feat/B<n>.<x>-slug           # brancher depuis un main à jour
```

`main` est **protégé** (PR obligatoire, push direct/force/suppression interdits, aucun bypass) → on ne pousse jamais sur `main` directement, on merge via PR. Ne jamais coder sur `main`.

---

## Setup initial (première fois)

```bash
pnpm install
cp .env.example .env          # Windows: copy .env.example .env  (puis renseigner FACEIT_API_KEY)
pnpm db:up                    # Postgres via Docker
pnpm db:push                  # applique le schéma
pnpm preflight                # doit être tout vert
```

## Cross-platform (macOS / Windows)

Tout est en Node/TypeScript et scripts npm → **identique sur Windows**. Seul le daemon
Docker diffère selon l'OS (voir ci-dessus) ; le reste des commandes est inchangé.
Ne PAS introduire de scripts shell bash-spécifiques dans les `package.json` : rester en
Node/tsx/outils cross-platform. Les globs de test sont passés quotés à Node (`"src/**/*.test.ts"`)
pour ne pas dépendre de l'expansion du shell.

## Stack

Monorepo **pnpm** en **TypeScript** (ESM).

| Workspace         | Rôle                              | Techno                                                          |
| ----------------- | --------------------------------- | --------------------------------------------------------------- |
| `apps/web`        | Le site                           | React 19 + Vite + Tailwind v4 + motion + zustand + lucide-react |
| `apps/api`        | API REST                          | Hono                                                            |
| `apps/worker`     | Sync ELO + inscription manuelle   | tsx, cron simple                                                |
| `apps/bot`        | Bot Discord `/register` (à venir) | discord.js                                                      |
| `packages/db`     | Schéma + client                   | Drizzle + PostgreSQL                                            |
| `packages/faceit` | Client typé de l'API Faceit       | zod                                                             |
| `packages/types`  | Types partagés front/back         | —                                                               |

## Commandes utiles

```bash
pnpm preflight                    # preflight (À FAIRE EN PREMIER)
pnpm dev                          # ⭐ API + front ensemble (watch) — le plus simple pour bosser
pnpm dev:api                      # API seule sur :3001
pnpm dev:worker                   # worker en boucle (10 min)
pnpm dev:web                      # front Vite sur :5173
pnpm sync:once                    # un passage de sync
pnpm --filter @4eselo/worker add-player <pseudoFaceit> [discordName]
pnpm test                         # unit + intégration
pnpm typecheck                    # tsc sur tout
pnpm lint / lint:fix              # ESLint
pnpm format / format:check        # Prettier
pnpm db:up / db:down / db:push / db:studio
```

## Suivi & tickets (GitHub)

Repo : **LilStick/4esElo** (privé). Le suivi vit sur GitHub, lisible via `gh` :

- **Epics** = blocs, titrés `EPIC B<n> · …` ; **tickets** = `B<n>.<x> · …` (ID logique dans le titre).
- **Labels de propriété** : `lilstick` (back/API/data) · `arthur` (front/UI/design).
- Workflow branches + pilotage via Claude Code : voir [CONTRIBUTING.md](./CONTRIBUTING.md).
- Prochain bloc : **B2 — Fondation data** (tickets B2.1 → B2.7).

```bash
gh issue list --label lilstick --state open
gh issue view <n>                 # lire un ticket + sa Definition of Done
```

La vision large + le vivier d'idées (features "to-do later", Premier Mode…) vit dans [ROADMAP.md](./ROADMAP.md).

## Créer des epics / tickets (FORMAT IMPOSÉ)

Tout le monde (LilStick, Arthur) peut proposer des features et créer des tickets — **toujours dans ce format**, pour que le suivi reste cohérent quel que soit qui (ou quel Claude) les crée :

- **Le format détaillé (corps Contexte/Quoi/DoD, exemple canonique) vit dans le skill [`refine`](.claude/skills/refine/SKILL.md)** — source de vérité unique, à suivre pour toute création d'epic/ticket.
- L'essentiel : milestone = `Bloc <n> — <Nom>` · epic = `EPIC B<n> · <Nom>` (label `epic`, corps = résumé lisible + checklist) · ticket = `B<n>.<x> · <titre court>` avec **contexte lisible par un humain sans ouvrir le code**, puis Quoi, puis DoD vérifiable.
- **Labels obligatoires** : un `type:*` (feature/chore/design/infra) + un `area:*` (api/web/worker/db/bot) + un **propriétaire** `arthur` (front/UI) ou `lilstick` (back/API/data).
- Feature hors blocs → soit la rattacher à un bloc, soit créer un nouveau bloc (milestone + epic). Noter l'idée dans [ROADMAP.md](./ROADMAP.md) si pas encore ticketée.

## Skills (Claude Code)

Des skills committés dans `.claude/skills/` encapsulent les formats/process (partagés avec Arthur) :

- **refine** — une idée → epic/ticket(s) au format (labels, dépendances, DoD).
- **start-ticket** — démarre un ticket : env OK, `main` à jour, branche `feat/…`, DoD + alerte dépendances.
- **open-pr** — PR propre : vert, 1 commit, changelog/`[NO-CHANGELOG]`, `Closes #n`.
- **migration** — changer le schéma DB (Drizzle) sans casser : schema.ts → migration SQL versionnée → commit → apply.
- **review-pr** — relire la PR de l'autre : diff, DoD, CI, format.
- **repo-catchup** — au `/resume`/reprise : résume l'activité récente du repo, par personne (toi vs l'autre).

Les skills gèrent le **format** ; la **sécurité** reste garantie par la machine (protection `main`, CI, `pnpm preflight`).

### Comment un skill se déclenche

- **Automatique** : Claude lit la `description` de chaque skill et le déclenche **tout seul** quand ta demande correspond — **pas besoin de taper `/`**.
- **Explicite** : tu peux forcer avec `/<nom-du-skill>`.
- Donc en écrivant un skill, la **`description` doit dire QUAND l'utiliser** (situations), pas juste ce qu'il fait — c'est ça le déclencheur.
- `/resume` est une commande **native** de Claude Code, pas un skill : pour un lancement **garanti** au démarrage de session, il faut un **hook `SessionStart`** dans `settings.json` (exécute un script, pas un skill).

## Règles d'architecture (DURES — pas des conseils)

Enforced par ESLint/hooks quand c'est possible (voir #79) ; le reste se rejette en review sans débat.

1. **Pattern provider — toute I/O réseau vit dans `packages/<provider>`** (client typé,
   validation zod des réponses, gestion d'erreurs, tests). Les apps (`api`, `worker`, `bot`)
   ne font **jamais** de `fetch` direct : elles consomment ces clients via des **interfaces
   injectables** (cf. `apps/worker/src/sync.ts`) → la logique se teste sans I/O. Côté web,
   tout fetch passe par `src/lib/api.ts`. Ajouter une source (Leetify, allstar…) = créer un
   nouveau package qui suit le pattern — aucune règle à modifier.
2. **Validation zod aux frontières.** Obligatoire : inputs API (params/query), env vars
   (au démarrage, via le `env.ts` de chaque app), réponses d'API externes. Recommandé :
   réponses de notre propre API côté front.
3. **Aucune erreur avalée.** Une erreur est gérée, propagée, ou loggée avec contexte.
   Un `catch` vide/no-op doit contenir un **commentaire** qui dit pourquoi et jusqu'à quand
   (ex. `// TODO(B2.4): géré quand la courbe arrive`) — sans commentaire, le lint le refuse.
4. **DB par défaut** : colonnes dédiées + index pour les clés de requête (filtres, tris,
   jointures), JSONB pour le variable. S'en écarter est possible mais **se justifie dans la PR**.
5. **Endpoint non officiel = isolé derrière une interface** + commenté comme fragile, pour
   pouvoir le remplacer sans toucher au métier (cf. historique ELO Faceit).

## Règles de tests

- **Tester au fil de l'eau**, pas après coup.
- Toute **logique métier** nouvelle → test **unitaire** avec mocks (zéro I/O).
- Tout **endpoint** nouveau ou modifié → test d'**intégration** (vraie DB, skip auto si Postgres absent).
- Tout **bugfix de comportement** → test de **non-régression écrit AVANT le fix** (reproduire le bug, puis corriger). Les corrections cosmétiques (typo, format) en sont dispensées.
- E2e : rare, seulement pour les parcours critiques.

## Conventions (à respecter)

- **Valider chaque incrément** : `pnpm typecheck` + `pnpm test` doivent rester verts.
- **Formater avant chaque commit** : `pnpm format` (la CI bloque sur `format:check`).
- **Migrations Drizzle** : modifier `packages/db/src/schema.ts` puis `pnpm db:generate`
  (SQL versionné) ; `pnpm db:push` en dev.
- **Ne jamais commit `.env`** (déjà gitignoré). La clé Faceit est une _server-side key_.
- **Types partagés** : toute forme échangée API↔front vit dans `packages/types`.
- **Auteurs** : seuls **LilStick** et **Arthur** signent les commits. **Jamais** de trailer `Co-Authored-By: Claude` ni de mention Claude.
- **Branches & tickets** : une branche par ticket (`feat/B<n>.<x>-slug`), PR vers `main` liée au ticket (`Closes #<n>`).
- **CI** : GitHub Actions lance typecheck + lint + tests sur chaque PR vers `main` (`.github/workflows/ci.yml`). Une PR doit être verte avant merge.
- **Changelog** : une PR **liée à un ticket** met à jour [CHANGELOG.md](./CHANGELOG.md) (ligne datée `AAAA-MM-JJ` + `#ticket`). Une PR **non liée** (infra/docs/chore) porte **`[NO-CHANGELOG]`** dans son titre. La CI vérifie l'un ou l'autre.
- **1 seul commit par PR** (lisibilité de l'historique `main`).
- **Nommage humain** : titres de tickets/epics/PR/commits **courts et clairs**, pas verbeux ni jargonneux. On doit comprendre d'un coup d'œil (ex. `B3.4 · Radar de comparaison`, pas une phrase de 15 mots).

## Sources de données

- **Faceit** (V1) : API officielle, ELO = nombre unique directement comparable. Clé serveur requise.
  - Les stats **par match** (`GET /matches/{id}/stats`) sont riches pour CS2 : ADR, clutch 1v1/1v2, entry frags, utility, flashs, HS%, multi-kills. La plupart des features avancées se calculent en stockant ces matchs (Bloc 2).
  - Pas d'endpoint officiel pour l'historique d'ELO → endpoint **interne non officiel** `api.faceit.com/stats/api/v1/stats/time/users/{id}/games/csgo` (elo + eloDiff par match), à isoler derrière une interface.
  - Pas dispo via API : ADR/rating _lifetime_, teammates, filtres temporels → on les **calcule** depuis les matchs stockés.
- **Premier** (plus tard) : pas d'API Valve officielle → Leetify (non officiel) ou snapshots.
  Le multi-compte par personne sera introduit **uniquement** pour Premier (Faceit interdit les smurfs).

## Modèle de données

- `players` — identité (Discord / Faceit / Steam), un compte Faceit par personne.
- `elo_snapshots` — série temporelle (`source` = faceit|premier) → **la courbe**.
  Le worker n'insère un point que si l'ELO a **changé** (évite de noyer la courbe).
- `faceit_match_stats` — une ligne par match/membre (colonnes clés indexées + stats en JSONB, ticket B2.1). C'est la brique qui débloque stats avancées, social, filtres, heatmap. Alimentation : ticket B2.3.
- (`faceit_matches` a été supprimée — doublon, cf. #60. Un éventuel besoin match-level (score, équipes) sera une nouvelle table `matches` à clé `matchId` seule.)

## État d'avancement

**V1 — Fondations : ✅ TERMINÉ** (epic GitHub #9)

- Scaffold monorepo + DB + Docker (colima/Docker Desktop)
- `packages/db`, `packages/faceit` (+ tests), `packages/types`
- `apps/worker` : sync ELO snapshot-on-change + add-player (smoke-test réel OK)
- `apps/api` : `/leaderboard`, `/players/:id`, `/players/:id/elo` (tests d'intégration)
- `apps/web` : classement + page joueur + courbe (design encore basique)
- Outillage : `pnpm preflight`, ESLint + Prettier, tests, CLAUDE.md, CONTRIBUTING
- Repo git privé + epics/tickets GitHub

**Roadmap (epics GitHub, blocs B1→B8)** — le détail vit dans les issues :

- 🔜 **B2 — Fondation data** (prochain) : ingestion matchs + backfill courbe ELO
- B1 — Design & assets (front, Arthur) · B3 — Profil enrichi · B4 — Social (asso)
- B5 — Engagement · B6 — Bot Discord · B7 — Features splashy · B8 — Highlights
- Ultérieur : **Premier Mode** (pas d'API Valve → Leetify/snapshots ; multi-compte par membre uniquement pour Premier)
