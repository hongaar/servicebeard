FROM oven/bun:1.2-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/providers/package.json ./packages/providers/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile || bun install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS api
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["bun", "run", "start"]

FROM base AS worker
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/worker
CMD ["bun", "run", "start"]

FROM nginx:alpine AS web
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
