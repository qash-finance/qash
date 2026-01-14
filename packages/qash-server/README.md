# Qash server implementation

This server implementation uses the following tech stack:

- [NestJS](https://nestjs.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Prisma](https://www.prisma.io/) (Database ORM)

# Requirements

Before you begin, you need to install the following tools:

- [Node (v22.15.0)](https://nodejs.org/en/download/package-manager)
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

# Getting Started

1. Clone the repository:
   ```sh
    git clone https://github.com/qash-finance/qash-server.git
    cd qash-server
   ```
2. Make sure to install all dependencies by running `pnpm install`
3. Run `cp .env.example .env`
4. Before spinning up a local database, make sure you don't have a running container with the same port that will be used by server, these ports are `6500`, `5050` and `3001`
5. Run `pnpm run prisma:generate` to generate prima client file
6. Make sure you have docker installed and running, then run `pnpm run docker:db:up`, it will spin up a local database and run the migration files under `./src/database/prisma/migrations`
7. Finally, run `pnpm run start:dev` to start the dev server

# [Production]

## 1. Build the server

```bash
pnpm run build
```

## 2. Run the server

```bash
pnpm run start:prod
```

# [Development] Running the app

```bash
# development, make sure you have a local database running
pnpm run start:dev
```

## Starting a local database

```bash
pnpm run docker:db:up
```

## Stopping a local database

```bash
pnpm run docker:db:down
```

# Database Management

## Complete Database Reset & Migration Process

Follow these steps to completely reset your database and apply fresh migrations:

### Step 1: Stop the Application

```bash
# Stop your development server if running
# Press Ctrl+C in the terminal where the server is running
```

### Step 2: Drop the Database

```bash
pnpm run docker:db:down
```

### Step 3: Generate Prisma Client

```bash
# Generate the updated Prisma client
pnpm run prisma:generate
```

### Step 4: Start Fresh Database

```bash
# Start a new database container
pnpm run docker:db:up
```

### Step 5: Verify Setup

```bash
# Start your development server
pnpm run start:dev
```

## Making Schema Changes

### 1. Edit Schema

Edit `src/database/prisma/schema.prisma` to modify your database models.

### 2. Generate Migration

```bash
# Generate migration file
pnpm run prisma:migrate:dev --schema ./src/database/prisma/schema.prisma
```

### 3. Update Prisma Client

```bash
pnpm run prisma:generate
```

### 4. Run New Migration File

```bash
pnpm run prisma:migrate:deploy
```

# Prisma Studio

Access your database through a web interface:

```bash
pnpm run prisma:studio
```

# [Testing] Running tests

```bash
# unit tests
pnpm run test

# test coverage
pnpm run test:cov
```

# [Production] Linter

```bash
pnpm run format
```
