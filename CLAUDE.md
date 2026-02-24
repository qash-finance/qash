# Qash Monorepo

## Project Structure

- `packages/qash-ui` — `@qash/web` Next.js frontend
- `packages/qash-server` — `@qash/server` NestJS API
- `packages/qash-doc` — Docusaurus documentation
- `packages/types` — `@qash/types` shared TypeScript types

## Common Tasks

### Build Types

Shared types must be built before other packages can use them:

```bash
sudo pnpm run build:types
```

### Reset Local Development Environment

Start a fresh local dev environment from scratch. Run all commands from the repo root:

```bash
# 1. Build shared types first (required before server can build)
sudo pnpm run build:types

# 2. Tear down existing database
sudo pnpm run db:down

# 3. Regenerate Prisma client (ensures client matches installed @prisma/client version)
sudo pnpm run prisma:generate

# 4. Start database (docker compose up + server build + prisma migrate)
sudo pnpm run db:up

# 5. Start the server in watch mode
sudo pnpm run start:dev

# 6. Start the web frontend (in a separate terminal)
sudo pnpm run dev:web

# 7. (Optional) Open Prisma Studio without launching a browser
sudo pnpm run prisma:studio:headless
```

### Other Useful Commands

```bash
# Start all packages in dev mode (types + web + server + docs in parallel)
pnpm dev

# Start only the web frontend
pnpm dev:web

# Start only the server
pnpm dev:server

# Run prisma migrations
sudo pnpm run prisma:migrate

# Generate prisma client
sudo pnpm run prisma:generate
```

## Notes

- All `pnpm --filter` scripts are available at the root — no need to `cd` into packages.
- The server's `docker:db:up` also runs `prisma migrate deploy` automatically after starting the container.
- Types package (`@qash/types`) must be built before building web or server.
