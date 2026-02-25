FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

FROM base AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

# Copy package.json files for workspace resolution (cached layer)
COPY packages/types/package.json ./packages/types/package.json
COPY packages/qash-ui/package.json ./packages/qash-ui/package.json

RUN pnpm install --frozen-lockfile

# Copy types source and build
COPY packages/types ./packages/types
RUN pnpm --filter @qash/types build

# Copy UI source
COPY packages/qash-ui ./packages/qash-ui

# NEXT_PUBLIC_ vars are read from .env at build time.
# The build workflow creates .env at the repo root from ENV_PROD secret.
COPY .env ./packages/qash-ui/.env

WORKDIR /app/packages/qash-ui
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/packages/qash-ui/public ./packages/qash-ui/public
COPY --from=builder --chown=nextjs:nodejs /app/packages/qash-ui/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/qash-ui/.next/static ./packages/qash-ui/.next/static

USER nextjs

ARG PORT=3000
ENV NODE_ENV=production
ENV PORT=$PORT
EXPOSE $PORT

CMD ["node", "packages/qash-ui/server.js"]
