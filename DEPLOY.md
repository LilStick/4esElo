# Déploiement — 4esElo sur Coolify

Le site = **4 ressources** sur le Coolify du VPS de l'asso. Tout se build depuis la **racine du repo** (monorepo pnpm).

> Migrations / seed initial et config prod (OAuth Discord, CORS, secrets) = ticket **B12.5** (à créer une fois l'accès Coolify obtenu). Ce fichier = le mémo d'infra.

## 1. PostgreSQL (base managée Coolify)

- Type : **PostgreSQL 16**.
- **Backups programmés** activés (cron quotidien, rétention ≥ 7 j ; vers S3 si dispo, sinon disque). L'historique ELO est irremplaçable.
- Appliquer le schéma après provisioning : `pnpm db:push` (ou les migrations Drizzle) avec `DATABASE_URL` pointant sur la base prod.

## 2. API (`apps/api/Dockerfile`)

- **Application**, Dockerfile = `apps/api/Dockerfile`, Base Directory = `/`.
- Port : **3001** (ou `API_PORT`). Healthcheck : **`/health`**.
- Sous-domaine (ex. `elo.<domaine>` pour le front, `api.elo.<domaine>` ou un path pour l'API) → SSL auto Coolify.

## 3. Worker (`apps/worker/Dockerfile`)

- **Service persistant** (redémarrage auto), **pas de port**, pas de domaine.
- Boucle de sync ELO toutes les ~10 min. (Alternative : Coolify Scheduled Task `*/10 * * * *` sur `--once`, mais le service persistant est plus simple.)

## 4. Web (`apps/web`) — site statique, **domaine d'Arthur**

- Type **Static Site** (build pack, pas de Dockerfile).
- Build : `pnpm install --frozen-lockfile && pnpm --filter @4eselo/web build` · Publish dir : `apps/web/dist`.
- ⚠️ Le front doit connaître l'**URL de l'API prod** (var `VITE_…` au build) → **à confirmer avec Arthur**.

## Variables d'env (secrets Coolify — jamais commités)

| Var                                              | Ressource   | Note                                             |
| ------------------------------------------------ | ----------- | ------------------------------------------------ |
| `DATABASE_URL`                                   | API, worker | base Coolify                                     |
| `FACEIT_API_KEY`                                 | API, worker | clé serveur Faceit                               |
| `STEAM_API_KEY`                                  | API, worker | présence / playtime                              |
| `API_PORT`                                       | API         | défaut 3001                                      |
| `WEB_ORIGINS`                                    | API         | **= domaine du front prod** (CORS)               |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`    | API         | app Discord **prod**                             |
| redirect URI OAuth                               | app Discord | = domaine prod (pas localhost)                   |
| `DISCORD_BOT_TOKEN` / `DISCORD_IDEAS_CHANNEL_ID` | API         | relais idées (optionnel)                         |
| session secret                                   | API         | à générer                                        |
| `PREMIER_ENABLED`                                | API/worker  | **`false`** tant que Premier (V2) n'est pas prêt |

## Notes

- Repo **privé** → connecter Coolify au repo (GitHub App ou deploy key).
- Auto-deploy sur push `main` (webhook).
- Après le 1er déploiement : seed des joueurs + deep-ingest de l'historique (voir B12.5).
