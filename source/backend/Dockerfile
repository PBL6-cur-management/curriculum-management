# F-27 BE-03. Build context is exactly source/backend. NODE_IMAGE is a pinned Node 24 Debian image.
ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN npm install --global pnpm@10.23.0

FROM base AS build
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm prisma:generate && pnpm build

# Applies migrations (and, as an explicit first-install action, the baseline seed). Never part of API startup.
FROM build AS migration
USER node
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM build AS production-deps
RUN pnpm prune --prod

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
