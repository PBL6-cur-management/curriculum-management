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
# --ignore-scripts: postinstall would run `prisma generate` after the prisma CLI (a dev dependency) is gone;
# the client is already generated into src/generated and compiled into dist.
RUN pnpm prune --prod --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
# PDF fonts, read at runtime from ../../../../assets relative to the compiled template.
COPY --chown=node:node assets ./assets
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

# Runtime plus Debian's Chromium for curriculum PDFs (F-24): pnpm skips Puppeteer's own browser download,
# and Chrome for Testing has no linux-arm64 build. The compose file drops every capability, so Chrome's
# sandbox cannot start; the page it renders is our escaped HTML with scripts and network off.
FROM runtime AS runtime-chromium
USER root
RUN apt-get update \
    && apt-get install --yes --no-install-recommends chromium \
    && rm -rf /var/lib/apt/lists/*
# The root filesystem is read-only: Chromium's profile, font and crash caches go to the /tmp tmpfs.
ENV PDF_BROWSER_PATH=/usr/bin/chromium \
    PDF_BROWSER_NO_SANDBOX=true \
    HOME=/tmp
USER node
