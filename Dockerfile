# syntax=docker/dockerfile:1.4
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# ── OSS dependencies ──
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/providers/package.json ./packages/providers/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile || bun install

# ── Extension sources (optional named build context: extension) ──
FROM base AS extension-context
COPY --from=extension . /extension

FROM base AS extension-deps
COPY --from=extension-context /extension /extension
WORKDIR /extension
RUN if [ -f package.json ]; then bun install --frozen-lockfile || bun install; else mkdir -p node_modules; fi

# ── Web build (bundles extension UI when manifest is present) ──
FROM base AS web-build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=extension-context /extension /extension
WORKDIR /app/apps/web
RUN SB_EXTENSION_MANIFEST=; \
    if [ -f /extension/extension.config.ts ]; then SB_EXTENSION_MANIFEST=/extension/extension.config.ts; \
    elif [ -f /extension/extension.config.js ]; then SB_EXTENSION_MANIFEST=/extension/extension.config.js; fi; \
    export SB_EXTENSION_MANIFEST; \
    bunx vite build

# ── API image ──
FROM base AS api
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=extension-context /extension /extension
COPY --from=extension-deps /extension/node_modules /extension/node_modules
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "if [ -f /extension/extension.config.ts ]; then export SB_EXTENSION_MANIFEST=/extension/extension.config.ts; elif [ -f /extension/extension.config.js ]; then export SB_EXTENSION_MANIFEST=/extension/extension.config.js; fi && cd /app && bun run db:migrate && cd /app/apps/api && bun run start"]

# ── Worker image ──
FROM base AS worker
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=extension-context /extension /extension
COPY --from=extension-deps /extension/node_modules /extension/node_modules
WORKDIR /app/apps/worker
CMD ["sh", "-c", "if [ -f /extension/extension.config.ts ]; then export SB_EXTENSION_MANIFEST=/extension/extension.config.ts; elif [ -f /extension/extension.config.js ]; then export SB_EXTENSION_MANIFEST=/extension/extension.config.js; fi && bun run start"]

# ── Web image ──
FROM nginx:alpine AS web
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
