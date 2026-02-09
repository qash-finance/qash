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

variable "tier" {
  description = "Cloud SQL machine tier (e.g. db-g1-small, db-standard-2)"
  type        = string
  default     = "db-g1-small"
}

variable "disk_size" {
  description = "Disk size in GB"
  type        = number
  default     = 20
}

variable "high_availability" {
  description = "Enable regional HA (automatic failover)"
  type        = bool
  default     = false
}

variable "read_replica" {
  description = "Create a read replica"
  type        = bool
  default     = false
}

variable "max_connections" {
  description = "PostgreSQL max_connections flag"
  type        = string
  default     = "100"
}

variable "vpc_network_id" {
  description = "VPC network self-link for private IP"
  type        = string
}

variable "db_password_secret" {
  description = "Secret Manager secret ID for storing the database password"
  type        = string
}

variable "deletion_protection" {
  description = "Prevent accidental deletion of the database"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default     = {}
}
