# =============================================================================
# Example: Deploy qash-server + Cloud SQL database
# =============================================================================
# This is a minimal example for testing module composition.
# Not intended for production use.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-southeast1"
}

variable "server_image" {
  description = "Container image for qash-server"
  type        = string
}

locals {
  name_prefix = "qash-example"
  labels = {
    project     = "qash"
    environment = "example"
    managed_by  = "terraform"
  }
}

# Enable APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "compute.googleapis.com",
    "vpcaccess.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Networking
module "networking" {
  source = "../../modules/networking"

  project_id  = var.project_id
  region      = var.region
  name_prefix = local.name_prefix
  labels      = local.labels

  depends_on = [google_project_service.apis]
}

# IAM
module "iam" {
  source = "../../modules/iam"

  project_id  = var.project_id
  name_prefix = local.name_prefix
  labels      = local.labels

  depends_on = [google_project_service.apis]
}

# Secrets
module "secrets" {
  source = "../../modules/secrets"

  project_id  = var.project_id
  name_prefix = local.name_prefix
  labels      = local.labels

  service_account_emails = {
    server = module.iam.service_account_emails["server"]
    web    = module.iam.service_account_emails["web"]
  }

  depends_on = [google_project_service.apis]
}

# Database
module "database" {
  source = "../../modules/database"

  project_id          = var.project_id
  region              = var.region
  name_prefix         = local.name_prefix
  tier                = "db-f1-micro"
  disk_size           = 10
  vpc_network_id      = module.networking.vpc_id
  db_password_secret  = module.secrets.secret_ids["database-password"]
  deletion_protection = false
  labels              = local.labels

  depends_on = [module.networking]
}

output "database_ip" {
  value = module.database.private_ip_address
}

output "database_name" {
  value = module.database.database_name
}

output "artifact_registry_url" {
  value = module.iam.artifact_registry_url
}
