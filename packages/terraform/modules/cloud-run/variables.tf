variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Deployment environment (staging or prod)"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "vpc_connector_id" {
  description = "Serverless VPC Access Connector ID"
  type        = string
}

# -----------------------------------------------------------------------------
# qash-server
# -----------------------------------------------------------------------------

variable "server_image" {
  description = "Container image URI for qash-server"
  type        = string
}

variable "server_cpu" {
  description = "CPU allocation for qash-server"
  type        = string
  default     = "2"
}

variable "server_memory" {
  description = "Memory allocation for qash-server"
  type        = string
  default     = "2Gi"
}

variable "server_min_instances" {
  description = "Minimum instances for qash-server"
  type        = number
  default     = 1
}

variable "server_max_instances" {
  description = "Maximum instances for qash-server"
  type        = number
  default     = 10
}

variable "server_service_account_email" {
  description = "Service account email for qash-server"
  type        = string
}

# -----------------------------------------------------------------------------
# qash-web
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
  description = "Minimum instances for qash-web"
  type        = number
  default     = 1
}

variable "web_max_instances" {
  description = "Maximum instances for qash-web"
  type        = number
  default     = 20
}

variable "web_service_account_email" {
  description = "Service account email for qash-web"
  type        = string
}

# -----------------------------------------------------------------------------
# qash-docs
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
  description = "Minimum instances for qash-docs (0 = scale to zero)"
  type        = number
  default     = 0
}

variable "docs_max_instances" {
  description = "Maximum instances for qash-docs"
  type        = number
  default     = 5
}

variable "docs_service_account_email" {
  description = "Service account email for qash-docs"
  type        = string
}

# -----------------------------------------------------------------------------
# Runtime config injected from other modules
# -----------------------------------------------------------------------------

variable "database_connection_name" {
  description = "Cloud SQL instance connection name"
  type        = string
}

variable "database_private_ip" {
  description = "Private IP of the Cloud SQL instance"
  type        = string
}

variable "database_name" {
  description = "Database name"
  type        = string
}

variable "redis_host" {
  description = "Redis host"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
}

variable "secret_ids" {
  description = "Map of secret name → Secret Manager resource ID"
  type        = map(string)
}
