# 4esElo

Classement ELO des membres du pôle CS2 de l'asso. Leaderboard, pages joueur, courbes d'ELO.

**V1 : Faceit uniquement.** Premier Mode (CS Rating) viendra en itération suivante.

## Stack

Monorepo pnpm en TypeScript :

- `apps/web` — React + Vite (à venir, phase 1)
- `apps/api` — API Hono
- `apps/bot` — bot Discord `/register` (phase 2)
- `apps/worker` — cron de refresh ELO (phase 1/3)
- `packages/db` — schéma & client Drizzle (PostgreSQL)
- `packages/types` — types partagés front/back

## Démarrage local

```bash
cp .env.example .env      # renseigne FACEIT_API_KEY quand tu l'auras
pnpm install
pnpm db:push              # applique le schéma
pnpm dev                  # API (:3001) + front (:5173) ensemble, en watch
```

`pnpm dev` lance tout ; sinon `pnpm dev:api` / `pnpm dev:web` séparément.
Vérif API : `curl http://localhost:3001/health` → `{"ok":true}`

## API (Hono, port 3001)

| Endpoint                             | Description                                |
| ------------------------------------ | ------------------------------------------ |
| `GET /health`                        | Ping                                       |
| `GET /leaderboard?source=faceit`     | Classement, dernier ELO par joueur         |
| `GET /players/:id?source=faceit`     | Profil + ELO courant + historique (courbe) |
| `GET /players/:id/elo?source=faceit` | Points de la courbe d'ELO                  |

`source` vaut `faceit` (défaut) ou `premier`.

## Worker

```bash
pnpm --filter @4eselo/worker add-player <pseudoFaceit> [discordName]  # inscription manuelle (avant le bot)
pnpm sync:once      # un passage de sync (ELO -> snapshot si changé)
pnpm dev:worker     # boucle toutes les 10 min
```

## Tests

```bash
pnpm test        # unit (faceit, worker) + intégration (api, nécessite pnpm db:up)
pnpm typecheck   # tsc sur tout le monorepo
```

## Modèle de données

- `players` — identités (Discord / Faceit / Steam)
- `elo_snapshots` — série temporelle d'ELO (source `faceit` | `premier`) → courbes
- `faceit_matches` — stats par match (backfill de courbe + détail)
