provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# -----------------------------------------------------------------------------
# Local values
# -----------------------------------------------------------------------------

locals {
  name_prefix = "qash-${var.environment}"

  common_labels = {
    project     = "qash"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# -----------------------------------------------------------------------------
# Enable required GCP APIs
# -----------------------------------------------------------------------------

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "compute.googleapis.com",
    "vpcaccess.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "certificatemanager.googleapis.com",
    "servicenetworking.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

module "networking" {
  source = "./modules/networking"

  project_id    = var.project_id
  region        = var.region
  name_prefix   = local.name_prefix
  ip_cidr_range = var.vpc_cidr_range
  labels        = local.common_labels

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# IAM – Service Accounts
# -----------------------------------------------------------------------------

module "iam" {
  source = "./modules/iam"

  project_id  = var.project_id
  name_prefix = local.name_prefix
  github_org  = var.github_org
  github_repo = var.github_repo
  labels      = local.common_labels

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------

module "secrets" {
  source = "./modules/secrets"

  project_id  = var.project_id
  name_prefix = local.name_prefix
  labels      = local.common_labels

  service_account_emails = {
    server = module.iam.service_account_emails["server"]
    web    = module.iam.service_account_emails["web"]
  }

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# Database – Cloud SQL PostgreSQL
# -----------------------------------------------------------------------------

module "database" {
  source = "./modules/database"

  project_id         = var.project_id
  region             = var.region
  name_prefix        = local.name_prefix
  tier               = var.db_tier
  disk_size          = var.db_disk_size
  high_availability  = var.db_high_availability
  read_replica       = var.db_read_replica
  vpc_network_id     = module.networking.vpc_id
  db_password_secret = module.secrets.secret_ids["database-password"]
  labels             = local.common_labels

  depends_on = [
    google_project_service.apis,
    module.networking,
  ]
}

# -----------------------------------------------------------------------------
# Cache – Memorystore Redis
# -----------------------------------------------------------------------------

module "cache" {
  source = "./modules/cache"

  project_id     = var.project_id
  region         = var.region
  name_prefix    = local.name_prefix
  tier           = var.redis_tier
  memory_size_gb = var.redis_memory_size_gb
  vpc_network_id = module.networking.vpc_id
  labels         = local.common_labels

  depends_on = [
    google_project_service.apis,
    module.networking,
  ]
}

# -----------------------------------------------------------------------------
# Cloud Run Services
# -----------------------------------------------------------------------------

module "cloud_run" {
  source = "./modules/cloud-run"

  project_id  = var.project_id
  region      = var.region
  name_prefix = local.name_prefix
  labels      = local.common_labels
  environment = var.environment
  domain_name = var.domain_name

  vpc_connector_id = module.networking.vpc_connector_id

  # Service images
  server_image = var.server_image
  web_image    = var.web_image
  docs_image   = var.docs_image

  # Server configuration
  server_cpu                   = var.server_cpu
  server_memory                = var.server_memory
  server_min_instances         = var.server_min_instances
  server_max_instances         = var.server_max_instances
  server_service_account_email = module.iam.service_account_emails["server"]

  # Web configuration
  web_cpu                   = var.web_cpu
  web_memory                = var.web_memory
  web_min_instances         = var.web_min_instances
  web_max_instances         = var.web_max_instances
  web_service_account_email = module.iam.service_account_emails["web"]

  # Docs configuration
  docs_cpu                   = var.docs_cpu
  docs_memory                = var.docs_memory
  docs_min_instances         = var.docs_min_instances
  docs_max_instances         = var.docs_max_instances
  docs_service_account_email = module.iam.service_account_emails["docs"]

  # Injected runtime config
  database_connection_name = module.database.instance_connection_name
  database_private_ip      = module.database.private_ip_address
  database_name            = module.database.database_name
  redis_host               = module.cache.redis_host
  redis_port               = module.cache.redis_port

  # Secret references
  secret_ids = module.secrets.secret_ids

  depends_on = [
    google_project_service.apis,
    module.networking,
    module.database,
    module.cache,
    module.secrets,
  ]
}

# -----------------------------------------------------------------------------
# Load Balancer
# -----------------------------------------------------------------------------

module "load_balancer" {
  source = "./modules/load-balancer"

  project_id  = var.project_id
  region      = var.region
  name_prefix = local.name_prefix
  domain_name = var.domain_name
  cdn_enabled = var.cdn_enabled
  labels      = local.common_labels

  cloud_run_services = {
    server = {
      name = module.cloud_run.service_names["server"]
    }
    web = {
      name = module.cloud_run.service_names["web"]
    }
    docs = {
      name = module.cloud_run.service_names["docs"]
    }
  }

  depends_on = [
    google_project_service.apis,
    module.cloud_run,
  ]
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

module "monitoring" {
  source = "./modules/monitoring"

  project_id         = var.project_id
  name_prefix        = local.name_prefix
  notification_email = var.notification_email
  slack_webhook_url  = var.slack_webhook_url
  labels             = local.common_labels

  monitored_services = ["server", "web", "docs"]

  cloud_run_service_names = module.cloud_run.service_names
  database_instance_name  = module.database.instance_name

  depends_on = [
    google_project_service.apis,
    module.cloud_run,
    module.database,
  ]
}
