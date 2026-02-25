FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

# Copy all package.json files for workspace resolution
COPY packages/types/package.json ./packages/types/package.json
COPY packages/qash-server/package.json ./packages/qash-server/package.json

RUN pnpm install --frozen-lockfile

# Copy types source and build it first
COPY packages/types ./packages/types
RUN pnpm --filter @qash/types build

# Copy server source and build
COPY packages/qash-server ./packages/qash-server

WORKDIR /app/packages/qash-server
RUN pnpm rebuild bcrypt
RUN pnpm run prisma:generate
RUN pnpm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/package.json
COPY packages/qash-server/package.json ./packages/qash-server/package.json

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy built types
COPY --from=builder /app/packages/types/dist ./packages/types/dist

# Copy built server
COPY --from=builder /app/packages/qash-server/dist ./packages/qash-server/dist

# Copy Prisma schema, config, and generated client
COPY --from=builder /app/packages/qash-server/src/database/prisma ./packages/qash-server/src/database/prisma
COPY --from=builder /app/packages/qash-server/src/database/generated ./packages/qash-server/src/database/generated

RUN cd packages/qash-server && pnpm rebuild bcrypt

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
USER nestjs

ARG PORT=3001
ENV NODE_ENV=production
ENV PORT=$PORT
EXPOSE $PORT

WORKDIR /app/packages/qash-server
CMD ["node", "dist/main"]
