# =============================================================================
# Production Environment Configuration
# =============================================================================

project_id  = "qash-prod" # TODO: Replace with actual GCP project ID
region      = "asia-southeast1"
environment = "prod"
domain_name = "qash.app" # TODO: Replace with actual domain

# -----------------------------------------------------------------------------
# Database – production-grade
# -----------------------------------------------------------------------------
db_tier              = "db-standard-2" # 2 vCPU, 7.5 GB RAM
db_disk_size         = 50
db_high_availability = true
db_read_replica      = true

# -----------------------------------------------------------------------------
# Cache – HA for production
# -----------------------------------------------------------------------------
redis_tier           = "STANDARD_HA"
redis_memory_size_gb = 5

# -----------------------------------------------------------------------------
# Cloud Run – qash-server
# -----------------------------------------------------------------------------
server_image         = "asia-southeast1-docker.pkg.dev/qash-prod/qash-prod-containers/qash-server:latest-prod"
server_cpu           = "2"
server_memory        = "2Gi"
server_min_instances = 1
server_max_instances = 10

# -----------------------------------------------------------------------------
# Cloud Run – qash-web
# -----------------------------------------------------------------------------
web_image         = "asia-southeast1-docker.pkg.dev/qash-prod/qash-prod-containers/qash-web:latest-prod"
web_cpu           = "1"
web_memory        = "1Gi"
web_min_instances = 1
web_max_instances = 20

# -----------------------------------------------------------------------------
# Cloud Run – qash-docs
# -----------------------------------------------------------------------------
docs_image         = "asia-southeast1-docker.pkg.dev/qash-prod/qash-prod-containers/qash-docs:latest-prod"
docs_cpu           = "1"
docs_memory        = "512Mi"
docs_min_instances = 0
docs_max_instances = 5

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------
notification_email = "alerts@qash.app" # TODO: Replace with actual email

# -----------------------------------------------------------------------------
# CDN
# -----------------------------------------------------------------------------
cdn_enabled = true
