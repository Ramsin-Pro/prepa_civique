# Image de l'API. À construire depuis la racine du dépôt :
#   docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS base
# OpenSSL est nécessaire au moteur de migration de Prisma sur Alpine.
RUN apk add --no-cache openssl
WORKDIR /repo

# Dépendances complètes, pour compiler
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace api --include-workspace-root=false

FROM deps AS build
COPY apps/api apps/api
RUN npm run build --workspace api

# Dépendances de production uniquement
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace api --include-workspace-root=false --omit=dev

FROM base AS runner
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY --from=prod-deps /repo /repo
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
COPY apps/api/prisma /repo/apps/api/prisma
COPY apps/api/prisma.config.ts /repo/apps/api/prisma.config.ts
# Fichiers de contenu, lus par le chargement des données (node dist/seed/index.js)
COPY apps/api/content /repo/apps/api/content
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
# Applique les migrations en attente, puis démarre l'API.
COPY apps/api/start.sh /repo/apps/api/start.sh
CMD ["sh", "start.sh"]
