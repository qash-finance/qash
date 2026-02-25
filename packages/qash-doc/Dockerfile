# Docs uses npm for Docker builds (no lock file, independent of monorepo)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

FROM base AS deps
WORKDIR /app
COPY packages/qash-doc/package.json ./
RUN npm install --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/qash-doc .
# Use the docker-specific docusaurus config if available
RUN if [ -f docusaurus.config.docker.js ]; then \
      cp docusaurus.config.docker.js docusaurus.config.js; \
    fi
RUN npx docusaurus build

FROM node:20-alpine AS runner
RUN npm install -g serve
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 docuser

COPY --from=builder --chown=docuser:nodejs /app/build ./build

USER docuser

ARG PORT=3000
ENV NODE_ENV=production
ENV PORT=$PORT
EXPOSE $PORT

CMD ["serve", "-s", "build", "-l", "3000"]
