# Environment Configuration Switch Agent

**Agent Name:** env-switch

**Description:** Switches environment configuration between GCP VM setup (ports 4000-4999) and normal development setup (port 3001), ensuring .env changes are not committed to GitHub.

## Capabilities

This agent handles:
- Switching to GCP VM configuration (ports 4000-4999 range)
- Switching to normal development configuration (port 3001)
- Creating backups of .env before changes
- Updating port configurations in .env file
- Showing current environment configuration
- Preventing .env from being committed to git

## Usage

```bash
/env-switch gcp     # Switch to GCP VM configuration
/env-switch dev     # Switch to development configuration
/env-switch show    # Show current configuration
```

Or with the Claude CLI:
```bash
claude --agent env-switch gcp
claude --agent env-switch dev
```

## What This Agent Does

### GCP VM Configuration (ports 4000-4999)
When switching to GCP VM setup:
- **Server Port:** 4001
- **PostgreSQL Port:** 4002
- **pgAdmin Port:** 4003 (mapped in docker-compose)
- **Redis Port:** 4004
- **SERVER_URL:** http://0.0.0.0:4001

### Development Configuration (normal ports)
When switching to development setup:
- **Server Port:** 3001
- **PostgreSQL Port:** 6500
- **Redis Port:** 6379
- **SERVER_URL:** http://0.0.0.0:3001

## Instructions for Claude

When this agent is invoked, execute the following steps:

### Step 1: Determine Target Configuration
Check the argument passed:
- `gcp` → Switch to GCP VM configuration
- `dev` → Switch to normal development configuration
- `show` → Display current configuration

### Step 2: Create Backup (for gcp/dev commands)
```bash
mkdir -p .env-backups
timestamp=$(date +%Y%m%d_%H%M%S)
cp .env .env-backups/.env.$timestamp
```

### Step 3a: Switch to GCP VM Configuration
Update the following values in `.env`:
```bash
PORT=4001
SERVER_URL=http://0.0.0.0:4001
POSTGRES_PORT=4002
REDIS_PORT=4004
POSTGRES_HOST=127.0.0.1
REDIS_HOST=127.0.0.1
```

Use the Edit tool to update each value:
- Find `PORT=<current-value>` and replace with `PORT=4001`
- Find `SERVER_URL=<current-value>` and replace with `SERVER_URL=http://0.0.0.0:4001`
- Find `POSTGRES_PORT=<current-value>` and replace with `POSTGRES_PORT=4002`
- Find `REDIS_PORT=<current-value>` and replace with `REDIS_PORT=4004`

### Step 3b: Switch to Development Configuration
Update the following values in `.env`:
```bash
PORT=3001
SERVER_URL=http://0.0.0.0:3001
POSTGRES_PORT=6500
REDIS_PORT=6379
POSTGRES_HOST=127.0.0.1
REDIS_HOST=127.0.0.1
ALLOWED_DOMAINS=http://localhost:3000
```

Use the Edit tool to update each value:
- Find `PORT=<current-value>` and replace with `PORT=3001`
- Find `SERVER_URL=<current-value>` and replace with `SERVER_URL=http://0.0.0.0:3001`
- Find `POSTGRES_PORT=<current-value>` and replace with `POSTGRES_PORT=6500`
- Find `REDIS_PORT=<current-value>` and replace with `REDIS_PORT=6379`

### Step 3c: Show Current Configuration
Display current configuration by reading the .env file:
```bash
echo "Current environment configuration:"
echo ""
echo "Server:"
grep "^PORT=" .env
grep "^SERVER_URL=" .env
echo ""
echo "Database:"
grep "^POSTGRES_HOST=" .env
grep "^POSTGRES_PORT=" .env
echo ""
echo "Redis:"
grep "^REDIS_HOST=" .env
grep "^REDIS_PORT=" .env
```

Determine environment type based on PORT value:
- PORT=4001 → GCP VM environment
- PORT=3001 → Development environment
- Other → Custom configuration

### Step 4: Verify Git Status
Ensure .env is not staged for commit:
```bash
git status --short | grep ".env" || echo ".env is not staged"
```

If .env is staged, warn the user and suggest:
```bash
git restore --staged .env
```

### Step 5: Update Docker Compose (if needed)
Check if docker-compose.yaml needs port updates. For GCP VM setup, ensure:
- postgres: ports: `${POSTGRES_PORT}:5432`
- pgAdmin: ports: `4003:80`
- redis: ports: `4004:6379`

These should already be configured correctly in the existing docker-compose.yaml.

### Step 6: Restart Services (optional)
Ask the user if they want to restart services:
- If currently running Docker containers, they may need to be restarted
- If the development server is running, it needs to be restarted

Suggest:
```bash
# Restart Docker containers
pnpm run docker:db:down && pnpm run docker:db:up

# Or if dev server is running, restart it
```

### Step 7: Confirm Success
Inform the user:
- ✓ Environment configuration switched
- ✓ Backup created at `.env-backups/.env.<timestamp>`
- ✓ New port configuration active
- ℹ Remember: .env is gitignored and won't be committed
- ℹ Services may need restart for changes to take effect

## Error Handling

- If .env file doesn't exist, create it from .env.example first
- If backup directory can't be created, warn but continue
- If .env is staged in git, warn the user to unstage it
- If values are already set to target configuration, inform user (no changes needed)

## Important Notes

### Git Integration
- The .env file should ALWAYS remain in .gitignore
- Never commit .env changes to GitHub
- Only .env.example should be tracked
- When switching branches, run this agent to restore correct configuration

### Port Ranges
- **GCP VM:** Uses 4000-4999 range for all services
- **Development:** Uses standard ports (3001, 6500, 6379)

### Workflow
1. Working on GCP VM → Use `/env-switch gcp`
2. Switching to another branch → Use `/env-switch dev`
3. Back to GCP VM work → Use `/env-switch gcp`

### Backup Management
- Backups are stored in `.env-backups/` directory
- Each backup has a timestamp
- To restore a backup manually: `cp .env-backups/.env.<timestamp> .env`

## Related Files
- [.env](.env) - Current environment configuration
- [.env.example](.env.example) - Example/template configuration
- [docker-compose.yaml](docker-compose.yaml) - Docker services configuration
- [Dockerfile](Dockerfile) - Application container configuration

## Quick Reference

```bash
# Switch to GCP VM
/env-switch gcp

# Switch to development
/env-switch dev

# Check current setup
/env-switch show

# View backups
ls -lh .env-backups/

# Manually restore backup
cp .env-backups/.env.20260112_120000 .env
```
