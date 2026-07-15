# Front 4esElo (React + Vite, SPA) - build puis servi en statique par nginx.
# Infra de deploiement (B12) : evite le Build Pack "Static" de Coolify dont
# l'installeur pnpm est casse. On maitrise pnpm via corepack + le SPA fallback.
# Sur Coolify : Build Pack = Docker, Base Directory = /, Dockerfile = /apps/web/Dockerfile.
FROM node:22-slim AS build

WORKDIR /app
RUN corepack enable

# Le workspace complet (monorepo pnpm) - le .dockerignore exclut node_modules/.env/dist.
COPY . .
RUN pnpm install --frozen-lockfile

# VITE_API_URL est bake dans le build (passe en build-arg par Coolify, secret buildtime).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @4eselo/web build

# --- Etape finale : nginx sert les fichiers statiques ---
FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# Conf SPA (try_files -> index.html) pour que les routes client survivent au refresh.
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
