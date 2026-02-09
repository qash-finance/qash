# Qash GCP Architecture

Detailed technical architecture of the Qash platform on Google Cloud Platform.

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Network Architecture](#network-architecture)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [Security Architecture](#security-architecture)
- [Module Dependencies](#module-dependencies)
- [Scaling Strategy](#scaling-strategy)
- [Disaster Recovery](#disaster-recovery)

---

## High-Level Overview

Qash is deployed as a **serverless microservices architecture** on GCP with the following characteristics:

- **Compute:** Cloud Run (managed containers, auto-scaling)
- **Database:** Cloud SQL PostgreSQL 16 (private IP only)
- **Cache:** Memorystore Redis 7.2 (private IP, AUTH enabled)
- **Storage:** Supabase (S3-compatible, external)
- **Load Balancing:** Global HTTPS Load Balancer with Cloud CDN
- **Security:** Cloud Armor, Workload Identity, Secret Manager
- **Observability:** Cloud Monitoring, Cloud Logging, Uptime Checks

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet Layer                          │
│  • DNS (A record → Load Balancer IP)                            │
│  • TLS 1.3 (Managed SSL Certificate)                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Edge / Security Layer                       │
│  • Cloud Load Balancer (Global, Anycast IP)                     │
│  • Cloud Armor (DDoS, WAF: XSS/SQLi, Rate Limiting)             │
│  • Cloud CDN (Static asset caching, 1h TTL)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
         ┌───────────────────┼───────────────────┐
         ↓                   ↓                   ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ qash-server  │    │  qash-web    │    │  qash-docs   │
│ (NestJS API) │    │ (Next.js)    │    │ (Docusaurus) │
│              │    │              │    │              │
│ /api/*       │    │ /*           │    │ /docs/*      │
│ Port 4001    │    │ Port 3000    │    │ Port 3000    │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                          ↓
         Serverless VPC Access Connector
              (10.8.0.0/28 reserved)
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Private Network (10.0.0.0/20)                 │
│  ┌────────────────────────┐    ┌────────────────────────┐      │
│  │  Cloud SQL PostgreSQL  │    │   Memorystore Redis    │      │
│  │  • Private IP only     │    │   • Private IP only    │      │
│  │  • Port 5432           │    │   • Port 6379          │      │
│  │  • TLS enforced        │    │   • AUTH + TLS         │      │
│  └────────────────────────┘    └────────────────────────┘      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Cloud NAT (Outbound internet for Cloud Run)        │       │
│  │  • Miden RPC (rpc.testnet.miden.io)                 │       │
│  │  • Para API (api.beta.getpara.com)                  │       │
│  │  • Mailgun (api.mailgun.net)                        │       │
│  │  • Supabase Storage (*.storage.supabase.co)         │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                            │
│  • Supabase Storage (user avatars, company logos)               │
│  • Miden Multisig Server (stateless, separate deployment)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Network Architecture

### VPC Configuration

```
VPC: qash-{env}-vpc (Custom mode)
├── Subnet: qash-{env}-private (10.0.0.0/20)
│   ├── Private Google Access: Enabled
│   ├── Purpose: Cloud SQL, Memorystore Redis
│   └── Service Networking Connection (VPC Peering)
│
├── Serverless VPC Access Connector (10.8.0.0/28)
│   ├── Min Throughput: 200 Mbps
│   ├── Max Throughput: 300 Mbps
│   └── Purpose: Cloud Run → Private resources
│
└── Cloud Router + NAT
    ├── NAT IP Allocation: Automatic
    ├── Log Filter: Errors only
    └── Purpose: Outbound internet from Cloud Run
```

### Firewall Rules

```
qash-{env}-allow-internal
  • Protocol: tcp/udp/icmp
  • Source: 10.0.0.0/8
  • Target: All instances in VPC
  • Purpose: Allow internal VPC communication
```

### Network Flow

**Inbound (Internet → Services):**

```
Client Request (HTTPS)
  → Load Balancer (Anycast IP)
  → Backend Service (NEG)
  → Cloud Run Service (Container)
```

**Outbound (Services → Internet):**

```
Cloud Run Container
  → VPC Connector
  → Cloud Router
  → Cloud NAT
  → Internet (Miden, Para, Mailgun, Supabase)
```

**Private (Services → Database/Cache):**

```
Cloud Run Container
  → VPC Connector
  → Private Subnet (10.0.0.0/20)
  → Cloud SQL / Redis (Private IP)
```

---

## Component Details

### 1. Cloud Run Services

#### qash-server (NestJS Backend)

**Configuration:**

- **CPU:** 2 vCPU (prod), 1 vCPU (staging)
- **Memory:** 2 GiB (prod), 1 GiB (staging)
- **Concurrency:** 80 requests per instance
- **Timeout:** 300 seconds
- **Min Instances:** 1 (prod), 0 (staging)
- **Max Instances:** 10 (prod), 3 (staging)
- **Health Check:** `GET /health` (port 4001)
- **VPC Access:** Connector (for Cloud SQL/Redis)

**Environment Variables:**

- `NODE_ENV=production`
- `PORT=4001`
- `DATABASE_HOST` (private IP from Cloud SQL)
- `REDIS_HOST` (private IP from Memorystore)
- Secrets via Secret Manager (JWT, Mailgun, Para, etc.)

**IAM Permissions:**

- Cloud SQL Client
- Secret Manager Accessor
- Monitoring Metric Writer
- Logging Writer

#### qash-web (Next.js Frontend)

**Configuration:**

- **CPU:** 1 vCPU
- **Memory:** 1 GiB (prod), 512 MiB (staging)
- **Concurrency:** 100 requests per instance
- **Timeout:** 60 seconds
- **Min Instances:** 1 (prod), 0 (staging)
- **Max Instances:** 20 (prod), 3 (staging)
- **Health Check:** `GET /` (port 3000)
- **VPC Access:** None (no private resources needed)

**Environment Variables:**

- `NODE_ENV=production`
- `NEXT_PUBLIC_API_URL=https://{domain}/api`
- `NEXT_PUBLIC_PARA_API_KEY` (from Secret Manager)

**IAM Permissions:**

- Secret Manager Accessor
- Monitoring Metric Writer
- Logging Writer

#### qash-docs (Docusaurus Documentation)

**Configuration:**

- **CPU:** 1 vCPU
- **Memory:** 512 MiB (prod), 256 MiB (staging)
- **Concurrency:** 250 requests per instance
- **Timeout:** 30 seconds
- **Min Instances:** 0 (scale to zero)
- **Max Instances:** 5 (prod), 2 (staging)
- **Health Check:** `GET /` (port 3000)
- **VPC Access:** None

**IAM Permissions:**

- Monitoring Metric Writer
- Logging Writer

### 2. Cloud SQL PostgreSQL

**Configuration:**

- **Version:** PostgreSQL 16
- **Tier:** db-standard-2 (prod), db-g1-small (staging)
- **Availability:** Regional HA (prod only)
- **Read Replica:** Yes (prod only)
- **Disk:** 50 GB SSD (prod), 20 GB (staging), auto-resize enabled
- **Networking:** Private IP only (no public IP)
- **Backup:** Automated daily, 7-day retention, PITR enabled

**Database Flags:**

- `max_connections=100`
- `log_min_duration_statement=1000` (log queries > 1s)

**Maintenance Window:**

- Day: Sunday
- Time: 18:00 UTC (2:00 AM SGT)
- Update Track: Stable

**Insights:**

- Query Insights enabled
- Query plans: 5 per minute
- Query string length: 4096 chars

### 3. Memorystore Redis

**Configuration:**

- **Version:** Redis 7.2
- **Tier:** STANDARD_HA (prod), BASIC (staging)
- **Memory:** 5 GB (prod), 1 GB (staging)
- **Networking:** Private IP, Private Service Access
- **Authentication:** AUTH enabled
- **TLS:** Server authentication mode

**Redis Config:**

- `maxmemory-policy=allkeys-lru` (evict least recently used keys)

**Maintenance Window:**

- Day: Sunday
- Time: 18:00 UTC (2:00 AM SGT)

### 4. Load Balancer & CDN

**Components:**

- **Global External HTTPS Load Balancer**
- **Managed SSL Certificate** (auto-provisioned via Let's Encrypt)
- **Cloud CDN** (enabled for web/docs, disabled for API)
- **Cloud Armor Security Policy**

**URL Routing:**

```
/api/*   → qash-server (Serverless NEG)
/docs/*  → qash-docs   (Serverless NEG)
/*       → qash-web     (Serverless NEG, default)
```

**Cloud Armor Rules:**

1. **Rate Limiting:** 100 requests/min per IP (429 response, 5-min ban)
2. **XSS Protection:** Block preconfigured XSS patterns (403 response)
3. **SQLi Protection:** Block SQL injection attempts (403 response)
4. **Default:** Allow all other traffic

**CDN Configuration:**

- **Cache Mode:** USE_ORIGIN_HEADERS (respects Cache-Control)
- **Default TTL:** 3600s (1 hour)
- **Max TTL:** 86400s (24 hours)
- **Serve While Stale:** 86400s

### 5. Secret Manager

**Secrets Stored:**

```
qash-{env}-database-password       → Auto-generated by Terraform
qash-{env}-jwt-secret              → Manual entry required
qash-{env}-jwt-refresh-secret      → Manual entry required
qash-{env}-mailgun-api-key         → Manual entry required
qash-{env}-para-api-key            → Manual entry required
qash-{env}-redis-auth-string       → Manual entry required
qash-{env}-supabase-storage-endpoint     → Manual entry required
qash-{env}-supabase-access-key-id        → Manual entry required
qash-{env}-supabase-secret-access-key    → Manual entry required
qash-{env}-miden-server-url              → Manual entry required
```

**Access Control:**

- qash-server has access to all secrets
- qash-web has access to `para-api-key` only
- qash-docs has no secret access

### 6. Monitoring & Alerting

**Uptime Checks:**

- All 3 services monitored every 60 seconds
- Timeout: 10 seconds
- Alert if down for 5 minutes

**Alert Policies:**

1. **High Error Rate** (per service)
   - Condition: 5xx errors > 5% for 5 minutes
   - Notification: Email + Slack

2. **High Latency** (qash-server only)
   - Condition: P95 latency > 2s for 5 minutes
   - Notification: Email + Slack

3. **Database High CPU**
   - Condition: CPU utilization > 80% for 5 minutes
   - Notification: Email + Slack

4. **Instance Scaling** (qash-server)
   - Condition: Instance count > 8 (approaching max of 10)
   - Notification: Email + Slack

**Dashboard Widgets:**

- Request rate per service (time series)
- P95 latency per service (time series)
- Cloud SQL CPU utilization
- Cloud SQL active connections
- Error rate by HTTP status code
- Container instance count

### 7. IAM & Workload Identity

**Service Accounts:**

```
qash-{env}-server-sa → qash-server Cloud Run
qash-{env}-web-sa    → qash-web Cloud Run
qash-{env}-docs-sa   → qash-docs Cloud Run
qash-{env}-cicd-sa   → GitHub Actions CI/CD
```

**Workload Identity Federation:**

```
GitHub Actions
  → OIDC Token (issued by GitHub)
  → Workload Identity Pool (qash-{env}-github-pool)
  → Service Account Impersonation (qash-{env}-cicd-sa)
  → GCP API Access (no static keys)
```

**CI/CD Service Account Permissions:**

- Cloud Run Developer (deploy services)
- Artifact Registry Writer (push images)
- Service Account User (act as service accounts)

---

## Data Flow

### 1. User Request Flow

```
Browser (HTTPS)
  ↓
1. DNS Resolution: qash.app → Load Balancer IP (Anycast)
  ↓
2. TLS Handshake: Managed SSL Certificate
  ↓
3. Cloud Armor: Rate limit check, XSS/SQLi detection
  ↓
4. URL Map Routing:
   /api/* → qash-server
   /*     → qash-web
  ↓
5. Backend Service → Cloud Run (Serverless NEG)
  ↓
6. Cloud Run Container: Process request
  ↓
7. Response: Cache-Control headers for CDN
  ↓
8. Cloud CDN: Cache static assets (if applicable)
  ↓
Browser receives response
```

### 2. Database Query Flow

```
Cloud Run Container (qash-server)
  ↓
1. Prisma ORM: Generate SQL query
  ↓
2. VPC Connector: Route to private network
  ↓
3. Cloud SQL Private IP: 10.0.x.x:5432
  ↓
4. Cloud SQL Proxy (built-in): TLS encryption
  ↓
5. PostgreSQL Engine: Execute query
  ↓
6. Query Insights: Log slow queries (>1s)
  ↓
Response → Prisma → Application
```

### 3. Cache Read/Write Flow

```
Cloud Run Container (qash-server)
  ↓
1. Redis Client: HGET / HSET command
  ↓
2. VPC Connector: Route to private network
  ↓
3. Memorystore Redis Private IP: 10.0.x.x:6379
  ↓
4. AUTH String: Authenticate connection
  ↓
5. TLS Handshake: Encrypt traffic
  ↓
6. Redis Engine: Execute command
  ↓
Response → Application
```

### 4. Secret Access Flow

```
Cloud Run Container (startup)
  ↓
1. Environment Variable: SECRET_NAME reference
  ↓
2. GCP Metadata Service: Request secret
  ↓
3. Secret Manager API: Verify IAM permissions
  ↓
4. Service Account: qash-{env}-server-sa has secretAccessor role
  ↓
5. Secret Manager: Return latest version
  ↓
6. Container: Secret injected as env var
```

### 5. External API Calls Flow

```
Cloud Run Container (qash-server)
  ↓
1. Outbound HTTP request (Miden, Para, Mailgun, Supabase)
  ↓
2. VPC Connector: Route to Cloud Router
  ↓
3. Cloud NAT: Allocate ephemeral public IP
  ↓
4. Internet Gateway: Route to destination
  ↓
5. External API: Process request
  ↓
Response → Cloud NAT → VPC Connector → Container
```

### 6. File Upload Flow (Supabase Storage)

```
Browser (qash-web)
  ↓
1. Pre-signed URL request: POST /api/upload/generate-url
  ↓
qash-server
  ↓
2. Generate pre-signed URL using S3_ACCESS_KEY_ID
  ↓
3. Return URL to browser
  ↓
Browser
  ↓
4. Direct upload to Supabase Storage (S3-compatible)
  ↓
Supabase Storage
  ↓
5. File stored in bucket (user-avatars, company-logos, multisig-logos)
  ↓
6. Webhook or polling: Update database record with file URL
```

---

## Security Architecture

### Defense in Depth Layers

```
Layer 1: Network (DDoS, IP filtering)
  → Cloud Armor WAF rules
  → Rate limiting (100 req/min per IP)

Layer 2: Transport (TLS)
  → Managed SSL certificates (TLS 1.3)
  → Cloud SQL TLS enforcement
  → Redis TLS server authentication

Layer 3: Application (Authentication)
  → Para JWT validation (JWKS)
  → HTTP-only cookies
  → Company-scoped authorization

Layer 4: Data (Encryption at rest)
  → Cloud SQL encrypted disks
  → Secret Manager encrypted secrets
  → Memorystore Redis encrypted memory

Layer 5: Access Control (IAM)
  → Least privilege service accounts
  → No public IPs on databases
  → Workload Identity (no static keys)
```

### Security Boundaries

```
┌─────────────────────────────────────────────┐
│  Public Internet Zone (Untrusted)           │
│  • Cloud Armor enforces WAF rules           │
│  • Rate limiting and DDoS protection        │
└─────────────────────────────────────────────┘
                   ↓ (HTTPS only)
┌─────────────────────────────────────────────┐
│  Cloud Run Zone (Semi-trusted)              │
│  • No direct database access                │
│  • Secrets injected via Secret Manager      │
│  • VPC connector for private resources      │
└─────────────────────────────────────────────┘
                   ↓ (VPC connector)
┌─────────────────────────────────────────────┐
│  Private Network Zone (Trusted)             │
│  • Cloud SQL: Private IP only, no internet  │
│  • Redis: Private IP only, AUTH required    │
│  • No public ingress allowed                │
└─────────────────────────────────────────────┘
```

### Secrets Management

**Never in Code:**

- All credentials stored in Secret Manager
- No `.env` files in containers
- No environment variables in Terraform (use Secret Manager references)

**Access Pattern:**

```
Secret Manager Secret
  ↓ (IAM binding)
Service Account (qash-{env}-server-sa)
  ↓ (secretAccessor role)
Cloud Run Container
  ↓ (environment variable injection)
Application Runtime
```

---

## Module Dependencies

### Terraform Module Dependency Graph

```
root (main.tf)
  │
  ├─→ google_project_service.apis (enable GCP APIs)
  │
  ├─→ networking
  │     └─→ [VPC, Subnets, VPC Connector, Cloud NAT]
  │
  ├─→ iam
  │     └─→ [Service Accounts, Workload Identity, Artifact Registry]
  │
  ├─→ secrets (depends on: iam)
  │     └─→ [Secret Manager Secrets, IAM Bindings]
  │
  ├─→ database (depends on: networking, secrets)
  │     └─→ [Cloud SQL Instance, Database, User, Read Replica]
  │
  ├─→ cache (depends on: networking)
  │     └─→ [Memorystore Redis Instance]
  │
  ├─→ cloud_run (depends on: networking, database, cache, secrets, iam)
  │     └─→ [3x Cloud Run Services, IAM Policies]
  │
  ├─→ load_balancer (depends on: cloud_run)
  │     └─→ [Global IP, SSL Cert, URL Map, Backend Services, Cloud Armor]
  │
  └─→ monitoring (depends on: cloud_run, database)
        └─→ [Uptime Checks, Alert Policies, Dashboard, Notification Channels]
```

### Module Creation Order

1. **Enable APIs** (required for all resources)
2. **Networking** (VPC, subnets, VPC connector)
3. **IAM** (service accounts for other modules)
4. **Secrets** (depends on IAM for access control)
5. **Database** (depends on networking for private IP)
6. **Cache** (depends on networking for private IP)
7. **Cloud Run** (depends on network, DB, cache, secrets, IAM)
8. **Load Balancer** (depends on Cloud Run services)
9. **Monitoring** (depends on all monitored resources)

### Module Outputs Used by Other Modules

```
networking.vpc_connector_id
  → cloud_run (VPC connector for private access)

iam.service_account_emails
  → cloud_run (service account identity)
  → secrets (IAM bindings for secret access)

secrets.secret_ids
  → database (database password reference)
  → cloud_run (environment variable injection)

database.instance_connection_name
  → cloud_run (Cloud SQL connection string)

database.private_ip_address
  → cloud_run (DATABASE_HOST environment variable)

cache.redis_host
  → cloud_run (REDIS_HOST environment variable)

cloud_run.service_names
  → load_balancer (backend service NEG)
  → monitoring (resource monitoring)
```

---

## Scaling Strategy

### Horizontal Scaling (Auto-scaling)

**Cloud Run Services:**

- Scale based on: Request count, CPU utilization, memory usage
- Scale-up: Instant (new container in 1-3 seconds)
- Scale-down: Gradual (idle timeout after 15 minutes)
- Cold start mitigation: Min instances > 0 (prod only)

**Scaling Thresholds:**

```
qash-server:
  CPU: 80% (default)
  Memory: 80% (default)
  Concurrency: 80 requests per instance
  Min: 1 (prod) / 0 (staging)
  Max: 10 (prod) / 3 (staging)

qash-web:
  Concurrency: 100 requests per instance
  Min: 1 (prod) / 0 (staging)
  Max: 20 (prod) / 3 (staging)

qash-docs:
  Concurrency: 250 requests per instance
  Min: 0 (scale to zero)
  Max: 5 (prod) / 2 (staging)
```

### Vertical Scaling (Resource Allocation)

**CPU/Memory Increase:**

1. Update `server_cpu` / `server_memory` in tfvars
2. Apply Terraform changes
3. Cloud Run creates new revision
4. Traffic gradually shifts to new revision (blue-green)

**Database Scaling:**

1. Update `db_tier` in tfvars (e.g., db-standard-2 → db-standard-4)
2. Apply Terraform changes
3. Cloud SQL performs online resize (minimal downtime)
4. For major tier changes, schedule during maintenance window

**Redis Scaling:**

1. Update `redis_memory_size_gb` in tfvars
2. Apply Terraform changes
3. Memorystore resizes online (no downtime)

### Geographic Scaling

**Current:** Single region (asia-southeast1)

**Future Multi-Region Setup:**

```
Global Load Balancer
  ├─→ Backend Service (asia-southeast1)
  │     └─→ Cloud Run services
  │
  └─→ Backend Service (us-central1)
        └─→ Cloud Run services (replica)

Cross-Region Database Replication:
  Primary: asia-southeast1
  Replica: us-central1 (read-only)
```

---

## Disaster Recovery

### Recovery Objectives

**RTO (Recovery Time Objective):**

- Cloud Run: < 5 minutes (automatic failover)
- Cloud SQL: < 10 minutes (regional HA failover)
- Memorystore Redis: < 5 minutes (STANDARD_HA auto-failover)

**RPO (Recovery Point Objective):**

- Database: 0 minutes (synchronous regional HA)
- Point-in-time recovery: Up to 7 days

### Backup Strategy

**Cloud SQL Automated Backups:**

- Frequency: Daily at 18:00 UTC (2 AM SGT)
- Retention: 7 days
- PITR: Transaction logs retained for 7 days
- Backup location: Same region as primary instance

**Manual Backup Process:**

```bash
# On-demand backup
gcloud sql backups create --instance=qash-prod-pg

# Export to Cloud Storage
gcloud sql export sql qash-prod-pg \
  gs://qash-prod-backups/manual-$(date +%Y%m%d-%H%M%S).sql \
  --database=qash
```

**Redis Persistence:**

- Memorystore BASIC: No persistence (data lost on failure)
- Memorystore STANDARD_HA: Cross-zone replication (RPO ~0)

### Disaster Recovery Procedures

**Scenario 1: Cloud Run Service Failure**

- Automatic: Cloud Run restarts unhealthy containers
- Manual rollback: `gcloud run services update-traffic --to-revisions=PREVIOUS=100`
- Recovery time: < 2 minutes

**Scenario 2: Database Corruption**

```bash
# Restore from backup
gcloud sql backups restore <BACKUP_ID> \
  --backup-instance=qash-prod-pg \
  --restore-instance=qash-prod-pg

# Or point-in-time recovery
gcloud sql backups restore-pitr \
  --instance=qash-prod-pg \
  --backup-location=2024-02-09T10:30:00.000Z
```

**Scenario 3: Region Failure**

1. Promote read replica in different region (if configured)
2. Update DNS to point to replica region
3. Redeploy Cloud Run services in replica region
4. Recovery time: 15-30 minutes (manual process)

**Scenario 4: Complete Data Loss**

1. Restore infrastructure from Terraform (10 minutes)
2. Restore database from backup (15 minutes)
3. Redeploy services (5 minutes)
4. Total recovery time: 30 minutes + data age (RPO)

---

## Performance Characteristics

### Latency Budget

```
End-to-end latency (P95):
  ┌─────────────────────────────────────────┐
  │ DNS Resolution         ~ 10ms           │
  │ TLS Handshake          ~ 50ms           │
  │ Cloud Armor/CDN        ~ 5ms            │
  │ Load Balancer          ~ 10ms           │
  │ Cloud Run (cold start) ~ 500-1500ms     │ ← One-time
  │ Cloud Run (warm)       ~ 5ms            │
  │ VPC Connector          ~ 1ms            │
  │ Application Logic      ~ 20-100ms       │
  │ Database Query         ~ 5-50ms         │
  │ Redis Cache            ~ 1-5ms          │
  └─────────────────────────────────────────┘

  Total (warm): 100-250ms (P95)
  Total (cold): 600-1700ms (P95, first request only)
```

### Throughput

**Load Balancer:**

- Capacity: Millions of requests per second (global Anycast)
- No configuration needed (auto-scales)

**Cloud Run:**

- Per instance: 80 requests (server), 100 requests (web)
- With 10 server instances: 800 concurrent requests
- Request rate: ~8,000 req/min (assuming 1s avg response time)

**Database:**

- db-standard-2: ~100 connections, ~2000 QPS
- Read replica adds ~1500 QPS (read-only)

**Redis:**

- 5GB STANDARD_HA: ~80,000 ops/second

### Cost Optimization

**Strategies:**

1. **Scale to zero** (staging services, docs)
2. **Right-size instances** (avoid over-provisioning)
3. **Enable CDN** (reduce origin requests)
4. **Use committed use discounts** (prod database)
5. **Monitor and alert** on anomalous costs

---

## Future Improvements

1. **Multi-Region Deployment**
   - Global load balancing across regions
   - Cross-region database replication
   - Local cache per region

2. **Advanced Caching**
   - Redis Cluster mode (sharding)
   - Cache warming on deployment
   - Client-side caching with ETags

3. **Database Optimization**
   - Connection pooling (PgBouncer)
   - Read/write splitting (replica for reads)
   - Partitioning large tables

4. **Observability Enhancements**
   - Distributed tracing (Cloud Trace)
   - Custom SLOs/SLIs
   - Cost anomaly detection

5. **Security Hardening**
   - Binary Authorization (signed images)
   - VPC Service Controls (data exfiltration prevention)
   - Secrets rotation automation

6. **CI/CD Improvements**
   - Automated rollback on high error rate
   - Canary deployments (gradual traffic shift)
   - Integration testing in staging

---

## Glossary

- **NEG** (Network Endpoint Group): Serverless backend for Cloud Run
- **VPC** (Virtual Private Cloud): Isolated network in GCP
- **PITR** (Point-in-Time Recovery): Restore database to any second
- **HA** (High Availability): Automatic failover to standby
- **WAF** (Web Application Firewall): Protection against attacks
- **JWKS** (JSON Web Key Set): Public keys for JWT verification
- **Anycast IP**: Single IP routed to nearest data center

---

## References

- [Cloud Run Architecture](https://cloud.google.com/run/docs/architecture)
- [Cloud SQL High Availability](https://cloud.google.com/sql/docs/postgres/high-availability)
- [VPC Connector Configuration](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access)
- [Cloud Armor Security Policies](https://cloud.google.com/armor/docs/security-policy-overview)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)

---

**Last Updated:** February 9, 2026  
**Maintained By:** Qash Infrastructure Team
