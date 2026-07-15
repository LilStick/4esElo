# API 4esElo (Hono) — image de prod.
# ⚠️ Build depuis la RACINE du repo (monorepo pnpm) :
#   docker build -f apps/api/Dockerfile -t 4eselo-api .
# Sur Coolify : Base Directory = / , Dockerfile = apps/api/Dockerfile.
FROM node:22-slim

WORKDIR /app
RUN corepack enable

# Le workspace complet (le .dockerignore exclut node_modules/.env/dist).
# On copie tout car pnpm --frozen-lockfile exige tous les package.json du workspace.
COPY . .
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
# L'API lit API_PORT (défaut 3001) ; Coolify peut l'overrider via env.
EXPOSE 3001
# /health est exposé pour le healthcheck Coolify.
CMD ["pnpm", "--filter", "@4eselo/api", "start"]
