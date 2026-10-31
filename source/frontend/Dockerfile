# F-27 FE-01. Build context is exactly source/frontend. The SPA calls a relative /api, so no API origin is baked in.
ARG NODE_IMAGE
ARG CADDY_IMAGE
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN npm install --global pnpm@10.23.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN pnpm build

FROM ${CADDY_IMAGE} AS runtime
COPY --from=build /app/dist /srv
