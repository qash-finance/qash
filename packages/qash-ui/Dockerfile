FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++ 
WORKDIR /app

FROM base AS deps
WORKDIR /app
# Install corepack and enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
# Copy pnpm configuration
COPY .npmrc* pnpm-workspace.yaml* ./
# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/nextjs/package.json ./packages/nextjs/package.json
COPY .env ./packages/nextjs/.env
# Install dependencies
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
WORKDIR /app/packages/nextjs
COPY packages/nextjs .
RUN pnpm --filter @qash/web build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/packages/nextjs/public ./packages/nextjs/public
COPY --from=builder /app/packages/nextjs/.next/standalone/packages/nextjs ./packages/nextjs
COPY --from=builder /app/packages/nextjs/.next/static ./packages/nextjs/.next/static

# Create a simple start script
RUN printf '#!/bin/sh\n\
cd /app/packages/nextjs && node server.js\n' > /app/start.sh
RUN chmod +x /app/start.sh

ARG PORT=3000
ENV NODE_ENV=production
ENV PORT=$PORT
ENV GENERATE_SOURCEMAP=false
EXPOSE $PORT

CMD ["/app/start.sh"]