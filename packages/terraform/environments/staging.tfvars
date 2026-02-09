# =============================================================================
# Staging Environment Configuration
# =============================================================================

project_id  = "qash-staging" # TODO: Replace with actual GCP project ID
region      = "asia-southeast1"
environment = "staging"
domain_name = "staging.qash.app" # TODO: Replace with actual domain

# -----------------------------------------------------------------------------
# Database – minimal for staging
# -----------------------------------------------------------------------------
db_tier              = "db-g1-small"
db_disk_size         = 20
db_high_availability = false
db_read_replica      = false

# -----------------------------------------------------------------------------
# Cache – basic tier for staging
# -----------------------------------------------------------------------------
redis_tier           = "BASIC"
redis_memory_size_gb = 1

# -----------------------------------------------------------------------------
# Cloud Run – qash-server
# -----------------------------------------------------------------------------
server_image         = "asia-southeast1-docker.pkg.dev/qash-staging/qash-staging-containers/qash-server:latest-staging"
server_cpu           = "1"
server_memory        = "1Gi"
server_min_instances = 0
server_max_instances = 3

# -----------------------------------------------------------------------------
# Cloud Run – qash-web
# -----------------------------------------------------------------------------
web_image         = "asia-southeast1-docker.pkg.dev/qash-staging/qash-staging-containers/qash-web:latest-staging"
web_cpu           = "1"
web_memory        = "512Mi"
web_min_instances = 0
web_max_instances = 3

# -----------------------------------------------------------------------------
# Cloud Run – qash-docs
# -----------------------------------------------------------------------------
docs_image         = "asia-southeast1-docker.pkg.dev/qash-staging/qash-staging-containers/qash-docs:latest-staging"
docs_cpu           = "1"
docs_memory        = "256Mi"
docs_min_instances = 0
docs_max_instances = 2

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------
notification_email = "alerts@qash.app" # TODO: Replace with actual email

# -----------------------------------------------------------------------------
# CDN
# -----------------------------------------------------------------------------
cdn_enabled = false
