# Development Server Reset Agent

**Agent Name:** dev-reset

**Description:** Automates the complete reset and restart of the local development environment, including stopping servers, clearing Docker volumes, resetting the database, and spinning up a fresh instance.

## Capabilities

This agent handles:
- Stopping running development servers
- Shutting down Docker containers and clearing volumes
- Resetting the local PostgreSQL database
- Regenerating Prisma client
- Starting fresh Docker database containers
- Launching the development server

## Usage

```bash
/dev-reset
```

Or with the Claude CLI:
```bash
claude --agent dev-reset
```

## What This Agent Does

### Phase 1: Cleanup
1. **Stop Development Server**
   - Checks for running Node/NestJS processes on port 3001
   - Gracefully stops the development server if running

2. **Clear Docker Environment**
   - Runs `pnpm run docker:db:down` to stop database containers
   - Removes Docker volumes to ensure a clean slate
   - Clears any orphaned containers

### Phase 2: Setup
3. **Generate Prisma Client**
   - Runs `pnpm run prisma:generate` to ensure latest schema

4. **Start Fresh Database**
   - Runs `pnpm run docker:db:up` to create new containers
   - Applies all migrations from `./src/database/prisma/migrations`
   - Verifies database connectivity

5. **Launch Development Server**
   - Runs `pnpm run start:dev` to start the NestJS application
   - Monitors startup for errors
   - Confirms server is running on port 3001

## Instructions for Claude

When this agent is invoked, execute the following steps:

### Step 1: Check Current State
```bash
# Check if development server is running
lsof -ti:3001 || echo "No server running on port 3001"

# Check Docker containers
docker ps -a | grep qash || echo "No qash containers found"
```

### Step 2: Stop Everything
```bash
# Kill any process on port 3001 (development server)
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "No process to kill on port 3001"

# Stop and remove Docker containers with volumes
pnpm run docker:db:down
```

### Step 3: Clean Docker Volumes (if needed)
```bash
# Remove volumes to ensure complete cleanup
docker volume ls | grep qash | awk '{print $2}' | xargs -r docker volume rm 2>/dev/null || echo "No volumes to remove"
```

### Step 4: Regenerate Prisma Client
```bash
pnpm run prisma:generate
```

### Step 5: Start Fresh Database
```bash
pnpm run docker:db:up
```

Wait for the database to be ready (approximately 5-10 seconds).

### Step 6: Verify Database
```bash
# Wait a moment for the database to fully initialize
sleep 5

# Check if containers are running
docker ps | grep postgres
```

### Step 7: Start Development Server
```bash
pnpm run start:dev
```

### Step 8: Confirm Success
Inform the user that:
- Docker containers are running
- Database migrations have been applied
- Development server is starting/running on port 3001
- Prisma Studio can be accessed via `pnpm run prisma:studio` if needed

## Error Handling

- If Docker is not running, inform the user to start Docker Desktop
- If ports 6500, 5050, or 3001 are occupied by non-qash processes, list the conflicting processes
- If Prisma generation fails, suggest checking the schema file at `src/database/prisma/schema.prisma`
- If database startup fails, check Docker logs with `docker logs <container-name>`

## Notes

- This agent assumes Docker and Docker Compose are installed
- This agent assumes pnpm is the package manager
- The development server runs in the foreground, so the user may need to open a new terminal
- All existing database data will be lost during this process
