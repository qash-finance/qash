# -----------------------------------------------------------------------------
# Root Variables
# -----------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resource deployment"
  type        = string
  default     = "asia-southeast1"
}

variable "environment" {
  description = "Deployment environment (staging or prod)"
  type        = string
  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "Environment must be 'staging' or 'prod'."
  }
}

# -----------------------------------------------------------------------------
# Domain / DNS
# -----------------------------------------------------------------------------

variable "domain_name" {
  description = "Primary domain name for the application (e.g. qash.app)"
  type        = string
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

variable "vpc_cidr_range" {
  description = "CIDR range for the Serverless VPC Access Connector"
  type        = string
  default     = "10.8.0.0/28"
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-g1-small"
}

variable "db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 20
}

variable "db_high_availability" {
  description = "Enable Cloud SQL high-availability (failover replica)"
  type        = bool
  default     = false
}

variable "db_read_replica" {
  description = "Create a read replica for Cloud SQL"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Cache (Redis)
# -----------------------------------------------------------------------------

variable "redis_tier" {
  description = "Memorystore Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "BASIC"
  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.redis_tier)
    error_message = "Redis tier must be 'BASIC' or 'STANDARD_HA'."
  }
}

variable "redis_memory_size_gb" {
  description = "Memorystore Redis memory in GB"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# Cloud Run – qash-server
# -----------------------------------------------------------------------------

variable "server_image" {
  description = "Container image URI for qash-server"
  type        = string
}

variable "server_cpu" {
  description = "CPU allocation for qash-server (e.g. '2')"
  type        = string
  default     = "2"
}

variable "server_memory" {
  description = "Memory allocation for qash-server (e.g. '2Gi')"
  type        = string
  default     = "2Gi"
}

variable "server_min_instances" {
  description = "Minimum number of qash-server instances"
  type        = number
  default     = 1
}

variable "server_max_instances" {
  description = "Maximum number of qash-server instances"
  type        = number
  default     = 10
}

# -----------------------------------------------------------------------------
# Cloud Run – qash-web
# -----------------------------------------------------------------------------

variable "web_image" {
  description = "Container image URI for qash-web"
  type        = string
}

variable "web_cpu" {
  description = "CPU allocation for qash-web"
  type        = string
  default     = "1"
}

variable "web_memory" {
  description = "Memory allocation for qash-web"
  type        = string
  default     = "1Gi"
}

variable "web_min_instances" {
  description = "Minimum number of qash-web instances"
  type        = number
  default     = 1
}

variable "web_max_instances" {
  description = "Maximum number of qash-web instances"
  type        = number
  default     = 20
}

# -----------------------------------------------------------------------------
# Cloud Run – qash-docs
# -----------------------------------------------------------------------------

variable "docs_image" {
  description = "Container image URI for qash-docs"
  type        = string
}

variable "docs_cpu" {
  description = "CPU allocation for qash-docs"
  type        = string
  default     = "1"
}

variable "docs_memory" {
  description = "Memory allocation for qash-docs"
  type        = string
  default     = "512Mi"
}

variable "docs_min_instances" {
  description = "Minimum number of qash-docs instances (0 = scale to zero)"
  type        = number
  default     = 0
}

variable "docs_max_instances" {
  description = "Maximum number of qash-docs instances"
  type        = number
  default     = 5
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "notification_email" {
  description = "Email address for alert notifications"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alert notifications (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# CI/CD – GitHub Workload Identity
# -----------------------------------------------------------------------------

variable "github_org" {
  description = "GitHub organization name (e.g. qash-finance)"
  type        = string
  default     = "qash-finance"
}

variable "github_repo" {
  description = "GitHub repository name (e.g. qash)"
  type        = string
  default     = "qash"
}

# -----------------------------------------------------------------------------
# CDN
# -----------------------------------------------------------------------------

variable "cdn_enabled" {
  description = "Enable Cloud CDN on the load balancer"
  type        = bool
  default     = true
}
