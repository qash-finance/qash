variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names (e.g. qash-staging)"
  type        = string
}

variable "ip_cidr_range" {
  description = "CIDR range for the Serverless VPC Access Connector"
  type        = string
  default     = "10.8.0.0/28"
  validation {
    condition     = can(cidrhost(var.ip_cidr_range, 0))
    error_message = "Must be a valid CIDR block."
  }
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default     = {}
}
