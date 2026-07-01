# CLAUDE.md — 4esElo

Classement ELO des membres du pôle CS2 de l'asso. Site qui agrège des API externes
(Faceit d'abord, Premier ensuite), stocke un historique, et affiche un classement +
des pages joueur avec courbe d'ELO.

---

## ⚠️ RÈGLE N°1 — Preflight obligatoire avant toute action

**Au début de CHAQUE session, lance `pnpm doctor` et NE FAIS RIEN d'autre tant que tout
n'est pas ✓.** Si un check est ✗, corrige-le (ou demande à l'utilisateur) AVANT de coder,
lancer, ou tester quoi que ce soit. Ne suppose jamais que l'environnement est prêt.

```bash
pnpm doctor
```

Ça vérifie : Node ≥ 20, pnpm, **le daemon Docker**, les deps installées, `.env` présent
(+ `DATABASE_URL`, `FACEIT_API_KEY`), et **Postgres joignable**. Exit ≠ 0 = bloquant.

Si un check échoue, le script affiche la commande de correction. Rappels courants :

- **Docker down** → Windows : lance Docker Desktop (ou WSL2) · macOS : `colima start` · Linux : `sudo systemctl start docker`
- **Deps** → `pnpm install`
- **`.env` absent** → `cp .env.example .env` (Windows : `copy .env.example .env`)
- **Postgres down** → `pnpm db:up`

---

## Setup initial (première fois)

```bash
pnpm install
cp .env.example .env          # Windows: copy .env.example .env  (puis renseigner FACEIT_API_KEY)
pnpm db:up                    # Postgres via Docker
pnpm db:push                  # applique le schéma
pnpm doctor                   # doit être tout vert
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
pnpm doctor                       # preflight (À FAIRE EN PREMIER)
pnpm dev:api                      # API sur :3001
pnpm dev:worker                   # worker en boucle (10 min)
pnpm sync:once                    # un passage de sync
pnpm --filter @4eselo/worker add-player <pseudoFaceit> [discordName]
pnpm test                         # unit + intégration
pnpm typecheck                    # tsc sur tout
pnpm db:up / db:down / db:push / db:studio
```

## Conventions (à respecter)

- **I/O aux extrémités, logique pure au milieu.** Le réseau (Faceit) et la DB sont des
  interfaces injectables (cf. `apps/worker/src/sync.ts`) → la logique se teste sans I/O.
- **Tester au fil de l'eau**, pas après coup. Unit massivement (mocks), intégration pour
  les endpoints (vraie DB, skip auto si Postgres absent), e2e rare.
- **Valider chaque incrément** : `pnpm typecheck` + `pnpm test` doivent rester verts.
- **Migrations Drizzle** : modifier `packages/db/src/schema.ts` puis `pnpm db:generate`
  (SQL versionné) ; `pnpm db:push` en dev.
- **Ne jamais commit `.env`** (déjà gitignoré). La clé Faceit est une _server-side key_.
- **Types partagés** : toute forme échangée API↔front vit dans `packages/types`.

## Sources de données

- **Faceit** (V1) : API officielle, ELO = nombre unique directement comparable. Clé serveur requise.
- **Premier** (plus tard) : pas d'API Valve officielle → Leetify (non officiel) ou snapshots.
  Le multi-compte par personne sera introduit **uniquement** pour Premier (Faceit interdit les smurfs).

## Modèle de données

- `players` — identité (Discord / Faceit / Steam), un compte Faceit par personne.
- `elo_snapshots` — série temporelle (`source` = faceit|premier) → **la courbe**.
  Le worker n'insère un point que si l'ELO a **changé** (évite de noyer la courbe).
- `faceit_matches` — stats par match (backfill/détail, à exploiter plus tard).

## État d'avancement

- ✅ Phase 0 : scaffold + DB + Docker
- ✅ Phase 1a : client Faceit (testé)
- ✅ Phase 1b : worker + sync (testé + smoke-test réel)
- ✅ Phase 1c : endpoints `/leaderboard`, `/players/:id`, `/players/:id/elo` (testés)
- 🔨 Phase 1d : `apps/web` (classement + page joueur + courbe)
- ⏳ Phase 2 : bot Discord `/register`
- ⏳ Phase 3 : Premier Mode
