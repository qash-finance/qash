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
COPY packages/qash-server/package.json ./packages/qash-server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/qash-server/node_modules ./packages/qash-server/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/qash-server ./packages/qash-server

WORKDIR /app/packages/qash-server

# Rebuild native dependencies
RUN pnpm rebuild bcrypt

# Generate Prisma client
RUN pnpm run prisma:generate

# Build the application
RUN pnpm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm for production dependencies
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace files
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/packages/qash-server/package.json ./packages/qash-server/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/packages/qash-server

# Copy built application
COPY --from=builder /app/packages/qash-server/dist ./dist

# Copy Prisma files (schema and config)
COPY --from=builder /app/packages/qash-server/src/database/prisma ./src/database/prisma

# Copy generated Prisma client
COPY --from=builder /app/packages/qash-server/src/database/generated ./src/database/generated

# Rebuild native dependencies for production
RUN pnpm rebuild bcrypt

ARG PORT=3001
ENV NODE_ENV=production
ENV PORT=$PORT
EXPOSE $PORT

CMD ["node", "dist/main"]
