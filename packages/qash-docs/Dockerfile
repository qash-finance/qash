# Base stage
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/qash-docs/package.json packages/qash-docs/.env.example ./packages/qash-docs/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/qash-docs/node_modules ./packages/qash-docs/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/qash-docs ./packages/qash-docs

WORKDIR /app/packages/qash-docs
RUN pnpm build

# Runner stage
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built static files
COPY --from=builder /app/packages/qash-docs/build ./build

# Install serve for static file serving
RUN npm install -g serve

ARG PORT=3000
ENV PORT=$PORT
EXPOSE $PORT

CMD ["serve", "-s", "build", "-l", "3000"]
