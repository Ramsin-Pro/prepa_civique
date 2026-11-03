# Image du site Next.js. À construire depuis la racine du dépôt :
#   docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace web --include-workspace-root=false

FROM deps AS build
COPY apps/web apps/web
# Adresse de l'API vue depuis le serveur Next.js : utilisée par le relais /api, figé au moment du build.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace web

FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# Sortie « standalone » : seul le nécessaire pour exécuter le serveur
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
