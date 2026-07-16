# Worker 4esElo (sync ELO) — service persistant qui boucle (~10 min).
# ⚠️ Build depuis la RACINE du repo (monorepo pnpm) :
#   docker build -f apps/worker/Dockerfile -t 4eselo-worker .
# Sur Coolify : Base Directory = / , Dockerfile = apps/worker/Dockerfile.
# Type = service persistant (redémarrage auto) — PAS un site web, aucun port.
FROM node:22-slim

WORKDIR /app
RUN corepack enable

# curl : transport de secours du backfill ELO rétro (curlFetch.ts) - il passe parfois
# le mur Cloudflare là où l'empreinte TLS de Node échoue. Absent de l'image slim.
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY . .
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
# `start` = boucle infinie (sync toutes les ~10 min). `--once` existe pour un run unique.
CMD ["pnpm", "--filter", "@4eselo/worker", "start"]
