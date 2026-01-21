# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/qash-ui/package.json ./packages/qash-ui/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/qash-ui/node_modules ./packages/qash-ui/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/qash-ui ./packages/qash-ui

WORKDIR /app/packages/qash-ui
RUN pnpm build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/packages/qash-ui/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/packages/qash-ui/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/qash-ui/.next/static ./packages/qash-ui/.next/static

USER nextjs

ARG PORT=3000
ENV PORT=$PORT
EXPOSE $PORT

CMD ["node", "packages/qash-ui/server.js"]
