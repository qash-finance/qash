# Qash GCP Infrastructure

Production-ready Terraform configuration for deploying Qash to Google Cloud Platform with Cloud Run, Cloud SQL,
Memorystore Redis, and full observability.

## Architecture Overview

```
Internet (HTTPS)
    ↓
Load Balancer (Global) + Cloud Armor + CDN
    ├── /api/*     → qash-server (Cloud Run)
    ├── /docs/*    → qash-docs (Cloud Run)
    └── /*         → qash-web (Cloud Run)
         ↓
    VPC Connector (Serverless VPC Access)
         ↓
    ┌────────────────────────────────────┐
    │   Private Network (10.0.0.0/20)    │
    │                                    │
    │   Cloud SQL PostgreSQL 16          │
    │   (Private IP only)                │
    │                                    │
    │   Memorystore Redis 7.2            │
    │   (Private IP + AUTH)              │
    └────────────────────────────────────┘
```

**Key Design Decisions:**

- **Cloud Run** for serverless container deployment (auto-scaling, pay-per-use)
- **Private networking** for database/cache (no public IPs)
- **Supabase** continues to host object storage (S3-compatible)
- **Workload Identity** for GitHub Actions (no static credentials)
- **Multi-environment** via Terraform workspaces (staging/prod)

## Prerequisites

1. **GCP Projects** (recommended: separate projects for staging/prod)

   ```bash
   # Create projects
   gcloud projects create qash-staging --name="Qash Staging"
   gcloud projects create qash-prod --name="Qash Production"

   # Enable billing
   gcloud billing projects link qash-staging --billing-account=<BILLING_ID>
   gcloud billing projects link qash-prod --billing-account=<BILLING_ID>
   ```

2. **Terraform** >= 1.6.0

   ```bash
   brew install terraform
   # or download from https://www.terraform.io/downloads
   ```

3. **gcloud CLI** configured

   ```bash
   gcloud auth application-default login
   gcloud config set project qash-staging  # or qash-prod
   ```

4. **Terraform State Bucket** (one per environment)

   ```bash
   # Staging
   gsutil mb -p qash-staging -l asia-southeast1 gs://qash-staging-terraform-state
   gsutil versioning set on gs://qash-staging-terraform-state

   # Production
   gsutil mb -p qash-prod -l asia-southeast1 gs://qash-prod-terraform-state
   gsutil versioning set on gs://qash-prod-terraform-state
   ```

5. **Domain DNS** ready to point to load balancer IP (obtained after apply)

## Initial Setup

### 1. Configure Environment Variables

Edit the appropriate tfvars file:

**For Staging** ([environments/staging.tfvars](environments/staging.tfvars)):

```hcl
project_id  = "qash-staging"          # Your actual GCP project ID
domain_name = "staging.qash.app"      # Your staging domain
notification_email = "alerts@qash.app"

# Image URIs will be updated after first CI/CD build
server_image = "asia-southeast1-docker.pkg.dev/qash-staging/qash-staging-containers/qash-server:latest-staging"
web_image    = "asia-southeast1-docker.pkg.dev/qash-staging/qash-staging-containers/qash-web:latest-staging"
docs_image   = "asia-southeast1-docker.pkg.dev/qash-staging/qash-staging-containers/qash-docs:latest-staging"
```

**For Production** ([environments/prod.tfvars](environments/prod.tfvars)):

```hcl
project_id  = "qash-prod"
domain_name = "qash.app"
notification_email = "alerts@qash.app"

# Production uses higher resources
db_tier              = "db-standard-2"  # 2 vCPU, 7.5 GB RAM
db_high_availability = true
redis_tier           = "STANDARD_HA"
```

### 2. Initialize Terraform

```bash
cd packages/terraform

# Initialize for staging
terraform init -backend-config="bucket=qash-staging-terraform-state"

# Create/select workspace
terraform workspace new staging
# or: terraform workspace select staging
```

### 3. Plan Infrastructure

```bash
terraform plan -var-file=environments/staging.tfvars -out=staging.tfplan

# Review the output carefully
# Expected: ~23 resources to be created
```

### 4. Apply Infrastructure

```bash
terraform apply staging.tfplan

# This will take 10-15 minutes
# Cloud SQL and Memorystore provisioning are the slowest
```

### 5. Note Important Outputs

```bash
terraform output

# Important outputs:
# - load_balancer_ip: Point your DNS A record here
# - artifact_registry_url: Container image registry
# - workload_identity_provider: For GitHub Actions
# - service_account_emails: For IAM configuration
```

### 6. Configure DNS

Point your domain to the load balancer IP:

```bash
# Get the IP
LB_IP=$(terraform output -raw load_balancer_ip)

# Create DNS A record
# staging.qash.app → $LB_IP
```

**Note:** SSL certificate provisioning requires DNS to be configured correctly. The managed certificate can take 15-60
minutes to provision.

### 7. Populate Secrets

After first apply, you need to manually populate Secret Manager secrets:

```bash
# Set your GCP project
export PROJECT_ID="qash-staging"

# Database password (already auto-generated, verify only)
gcloud secrets versions list qash-staging-database-password --project=$PROJECT_ID

# Populate remaining secrets
echo -n "your-jwt-secret-here" | gcloud secrets versions add qash-staging-jwt-secret --data-file=- --project=$PROJECT_ID
echo -n "your-refresh-secret" | gcloud secrets versions add qash-staging-jwt-refresh-secret --data-file=- --project=$PROJECT_ID
echo -n "your-mailgun-key" | gcloud secrets versions add qash-staging-mailgun-api-key --data-file=- --project=$PROJECT_ID
echo -n "your-para-key" | gcloud secrets versions add qash-staging-para-api-key --data-file=- --project=$PROJECT_ID
echo -n "your-redis-password" | gcloud secrets versions add qash-staging-redis-auth-string --data-file=- --project=$PROJECT_ID
echo -n "https://your-project.storage.supabase.co/storage/v1/s3" | gcloud secrets versions add qash-staging-supabase-storage-endpoint --data-file=- --project=$PROJECT_ID
echo -n "your-supabase-access-key" | gcloud secrets versions add qash-staging-supabase-access-key-id --data-file=- --project=$PROJECT_ID
echo -n "your-supabase-secret-key" | gcloud secrets versions add qash-staging-supabase-secret-access-key --data-file=- --project=$PROJECT_ID
echo -n "https://your-multisig-server.com" | gcloud secrets versions add qash-staging-miden-server-url --data-file=- --project=$PROJECT_ID
```

**Alternative:** Use a `.env` file and populate in bulk:

```bash
# Create a secret-values.env file (don't commit!)
cat > secret-values.env <<EOF
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret
MAILGUN_API_KEY=your-mailgun-key
# ... etc
EOF

# Script to populate all secrets
while IFS='=' read -r key value; do
  secret_name="qash-staging-$(echo $key | tr '[:upper:]' '[:lower:]' | tr '_' '-')"
  echo -n "$value" | gcloud secrets versions add "$secret_name" --data-file=- --project=$PROJECT_ID
done < secret-values.env

# Delete the file after use
rm secret-values.env
```

### 8. Configure GitHub Actions

Add these secrets to your GitHub repository (`Settings` → `Secrets and variables` → `Actions`):

```bash
# Get values from Terraform outputs
terraform output workload_identity_provider
terraform output -json service_account_emails | jq -r '.cicd'

# Add to GitHub:
GCP_PROJECT_ID_STAGING = "qash-staging"
GCP_PROJECT_ID_PROD = "qash-prod"
GCP_WORKLOAD_IDENTITY_PROVIDER = "projects/123456789/locations/global/workloadIdentityPools/..."
GCP_CICD_SERVICE_ACCOUNT = "qash-staging-cicd-sa@qash-staging.iam.gserviceaccount.com"
SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/..." (optional)
```

### 9. Deploy Application

Push to the `stg` branch to trigger deployment:

```bash
git checkout -b stg
git push origin stg

# GitHub Actions will:
# 1. Build Docker images
# 2. Push to Artifact Registry
# 3. Deploy to Cloud Run
# 4. Verify health checks
```

### 10. Run Database Migrations

SSH into a Cloud Run instance or use Cloud Run Jobs:

```bash
# Option 1: Via gcloud run jobs (recommended)
gcloud run jobs create qash-migrate \
  --image asia-southeast1-docker.pkg.dev/qash-staging/qash-staging-containers/qash-server:latest-staging \
  --region asia-southeast1 \
  --service-account qash-staging-server-sa@qash-staging.iam.gserviceaccount.com \
  --vpc-connector qash-staging-connector \
  --set-env-vars NODE_ENV=production \
  --command pnpm \
  --args "run,prisma:migrate:deploy"

gcloud run jobs execute qash-migrate --region asia-southeast1

# Option 2: Via local connection with Cloud SQL Proxy
cloud_sql_proxy -instances=qash-staging:asia-southeast1:qash-staging-pg=tcp:5432 &
cd ../../qash-server
pnpm run prisma:migrate:deploy
```

## Deploying Production

Repeat the same process with production tfvars:

```bash
# Switch to prod workspace
terraform workspace select prod
# or: terraform workspace new prod

# Initialize with prod backend
terraform init -backend-config="bucket=qash-prod-terraform-state"

# Plan and apply
terraform plan -var-file=environments/prod.tfvars -out=prod.tfplan
terraform apply prod.tfplan

# Deploy via GitHub Actions
git checkout main
git push origin main
```

## Common Operations

### Update Infrastructure

```bash
# Make changes to .tf files or tfvars
terraform plan -var-file=environments/staging.tfvars
terraform apply -var-file=environments/staging.tfvars
```

### Deploy New Application Version

Push to `stg` or `main` branch — GitHub Actions handles it automatically.

Or manually:

```bash
# Build and push image
export IMAGE_TAG="v1.2.3"
export REGISTRY="asia-southeast1-docker.pkg.dev/qash-staging/qash-staging-containers"

docker build -t $REGISTRY/qash-server:$IMAGE_TAG packages/qash-server
docker push $REGISTRY/qash-server:$IMAGE_TAG

# Deploy to Cloud Run
gcloud run deploy qash-staging-server \
  --image $REGISTRY/qash-server:$IMAGE_TAG \
  --region asia-southeast1
```

### View Logs

```bash
# All logs from qash-server
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=qash-staging-server" \
  --limit 50 \
  --format json

# Filter for errors only
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=qash-staging-server AND severity>=ERROR" \
  --limit 20

# Tail logs in real-time
gcloud alpha logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=qash-staging-server"
```

### Access Database

```bash
# Via Cloud SQL Proxy (no public IP)
cloud_sql_proxy -instances=qash-staging:asia-southeast1:qash-staging-pg=tcp:5432 &

# Connect with psql
psql "host=127.0.0.1 port=5432 dbname=qash user=qash password=<from-secret-manager>"

# Or get password from Secret Manager
DB_PASSWORD=$(gcloud secrets versions access latest --secret=qash-staging-database-password)
psql "host=127.0.0.1 port=5432 dbname=qash user=qash password=$DB_PASSWORD"
```

### Check Resource Costs

```bash
# Estimated costs (requires billing export to BigQuery)
gcloud billing accounts list

# View in GCP Console:
# https://console.cloud.google.com/billing/reports
```

### Rolling Back a Deployment

```bash
# List revisions
gcloud run revisions list --service qash-staging-server --region asia-southeast1

# Roll back to previous revision
gcloud run services update-traffic qash-staging-server \
  --to-revisions=qash-staging-server-00005-abc=100 \
  --region asia-southeast1
```

### Scaling Services

```bash
# Temporarily increase max instances
gcloud run services update qash-staging-server \
  --max-instances 20 \
  --region asia-southeast1

# Or update via Terraform (permanent)
# Edit environments/staging.tfvars:
server_max_instances = 20

terraform apply -var-file=environments/staging.tfvars
```

## Monitoring & Alerts

### Access Dashboard

```bash
# Get dashboard URL
terraform output -json | jq -r '.dashboard_urls.value'

# Or open directly
open "https://console.cloud.google.com/monitoring/dashboards"
```

### Test Alerts

```bash
# Trigger high error rate alert (send many requests to /nonexistent)
for i in {1..100}; do
  curl -s https://staging.qash.app/nonexistent > /dev/null &
done
```

### View Alert History

```bash
gcloud alpha monitoring policies list

# Get incidents for a policy
gcloud alpha monitoring alerts list \
  --filter="state='OPEN'"
```

## Disaster Recovery

### Database Backup & Restore

```bash
# List backups
gcloud sql backups list --instance=qash-staging-pg

# Restore from backup
gcloud sql backups restore <BACKUP_ID> \
  --backup-instance=qash-staging-pg \
  --restore-instance=qash-staging-pg

# Or point-in-time recovery
gcloud sql backups restore-pitr \
  --instance=qash-staging-pg \
  --backup-location=2024-02-09T10:30:00.000Z
```

### Export Database

```bash
# Export to Cloud Storage
gcloud sql export sql qash-staging-pg \
  gs://qash-staging-backups/manual-backup-$(date +%Y%m%d).sql \
  --database=qash

# Import from export
gcloud sql import sql qash-staging-pg \
  gs://qash-staging-backups/manual-backup-20240209.sql \
  --database=qash
```

### Destroy Infrastructure

⚠️ **WARNING:** This will DELETE all resources including databases!

```bash
# Staging
terraform workspace select staging
terraform destroy -var-file=environments/staging.tfvars

# Production (extra confirmation required)
terraform workspace select prod
terraform destroy -var-file=environments/prod.tfvars
```

## Troubleshooting

### Cloud SQL Connection Issues

```bash
# Verify VPC connector is working
gcloud compute networks vpc-access connectors describe qash-staging-connector \
  --region asia-southeast1

# Check Cloud Run service has connector attached
gcloud run services describe qash-staging-server \
  --region asia-southeast1 \
  --format="value(spec.template.spec.containers[0].resources.limits)"
```

### SSL Certificate Not Provisioning

```bash
# Check certificate status
gcloud compute ssl-certificates describe qash-staging-ssl-cert

# Common issues:
# 1. DNS not pointing to load balancer IP
# 2. Domain validation pending (can take 15-60 minutes)
# 3. CAA DNS record blocking Let's Encrypt

# Verify DNS
dig staging.qash.app +short
# Should return load_balancer_ip
```

### Service Not Starting

```bash
# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=qash-staging-server" \
  --limit 50 \
  --format json

# Common issues:
# 1. Secret not populated
# 2. Database connection failure
# 3. Container startup timeout (increase timeout in variables.tf)
```

### High Costs

1. Check if Cloud NAT is routing too much traffic (use VPC Flow Logs)
2. Verify min_instances is not too high (set to 0 for non-critical services)
3. Review Cloud SQL instance tier (downgrade if over-provisioned)
4. Enable Cloud CDN to reduce origin requests

## Security Best Practices

- ✅ **No public IPs** on databases (Cloud SQL/Redis private only)
- ✅ **Workload Identity** instead of service account keys
- ✅ **Secret Manager** for all credentials (never in environment variables)
- ✅ **Cloud Armor** for DDoS protection and WAF rules
- ✅ **Least privilege IAM** (each service has minimal permissions)
- ✅ **Encryption at rest** (Cloud SQL, secrets, disks)
- ✅ **TLS in transit** (HTTPS everywhere, Redis TLS)

## Cost Estimation

**Staging** (~$175/month):

- Cloud SQL db-g1-small: $25
- Memorystore Redis 1GB: $35
- Cloud Run (minimal): $15
- Networking: $5
- Monitoring/Logging: $100

**Production** (~$650/month):

- Cloud SQL db-standard-2 + replica: $350
- Memorystore Redis 5GB HA: $200
- Cloud Run (moderate): $65
- CDN: $10
- Monitoring/Logging: $30

## Additional Resources

- [Terraform Registry - Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Best Practices](https://cloud.google.com/sql/docs/postgres/best-practices)
- [Workload Identity Setup](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Architecture Diagram](./ARCHITECTURE.md)

## Support

For issues or questions:

- **Infrastructure:** Check [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Application:** See main repository README
- **GCP Support:** https://cloud.google.com/support
