# Worker 4esElo (sync ELO) — service persistant qui boucle (~10 min).
# ⚠️ Build depuis la RACINE du repo (monorepo pnpm) :
#   docker build -f apps/worker/Dockerfile -t 4eselo-worker .
# Sur Coolify : Base Directory = / , Dockerfile = apps/worker/Dockerfile.
# Type = service persistant (redémarrage auto) — PAS un site web, aucun port.
FROM node:22-slim

WORKDIR /app
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
# `start` = boucle infinie (sync toutes les ~10 min). `--once` existe pour un run unique.
CMD ["pnpm", "--filter", "@4eselo/worker", "start"]
