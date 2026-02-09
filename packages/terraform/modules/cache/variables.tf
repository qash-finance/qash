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
  description = "Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "BASIC"
  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.tier)
    error_message = "Redis tier must be 'BASIC' or 'STANDARD_HA'."
  }
}

variable "memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

variable "vpc_network_id" {
  description = "VPC network self-link for private connectivity"
  type        = string
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default     = {}
}
