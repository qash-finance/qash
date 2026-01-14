# Qash Monorepo

A monorepo containing the Qash web application, documentation, and server API.

## Prerequisites

- Node.js >= 18.17.0
- pnpm >= 9.0.0

## Setup

```bash
# Install pnpm if not installed
npm install -g pnpm

# Install all dependencies
pnpm install
```

## Packages

| Package | Description | Path |
|---------|-------------|------|
| `@qash/server` | NestJS API Server | `packages/qash-server` |
| `@qash/web` | Next.js Web Application | `packages/qash-ui/packages/nextjs` |
| `@qash/docs` | Docusaurus Documentation | `packages/qash-ui/packages/docs` |

## Development

### Run all packages in development mode
```bash
pnpm dev
```

### Run individual packages
```bash
# Web app
pnpm dev:web

# Server
pnpm dev:server

# Docs
pnpm dev:docs
```

## Build

### Build all packages
```bash
pnpm build
```

### Build individual packages
```bash
pnpm build:web
pnpm build:server
pnpm build:docs
```

## Database (Server)

```bash
# Start database
pnpm db:up

# Stop database
pnpm db:down

# Run Prisma migrations
pnpm prisma:migrate

# Generate Prisma client
pnpm prisma:generate

# Open Prisma Studio
pnpm prisma:studio
```

## Testing

```bash
# Run all tests
pnpm test

# Run server tests
pnpm test:server

# Run e2e tests
pnpm test:e2e
```

## Linting & Formatting

```bash
# Lint all packages
pnpm lint

# Format all files
pnpm format
```

## Working with packages

```bash
# Add a dependency to a specific package
pnpm --filter @qash/web add <package-name>

# Add a dev dependency to a specific package
pnpm --filter @qash/server add -D <package-name>

# Run a script in a specific package
pnpm --filter @qash/web <script-name>
```

## Project Structure

```
qash/
├── package.json           # Root package.json (workspace scripts)
├── pnpm-workspace.yaml    # pnpm workspace configuration
├── .npmrc                 # pnpm configuration
├── tsconfig.json          # Root TypeScript config
└── packages/
    ├── qash-server/       # @qash/server - NestJS API
    └── qash-ui/      # UI packages
        └── packages/
            ├── nextjs/    # @qash/web - Next.js app
            └── docs/      # @qash/docs - Docusaurus
```

## License

MIT
