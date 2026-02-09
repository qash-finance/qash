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

variable "domain_name" {
  description = "Primary domain name for the SSL certificate and URL map"
  type        = string
}

variable "cdn_enabled" {
  description = "Enable Cloud CDN on web and docs backends"
  type        = bool
  default     = true
}

variable "cloud_run_services" {
  description = "Map of service key → { name } for Cloud Run services"
  type = map(object({
    name = string
  }))
}

variable "labels" {
  description = "Labels to apply to forwarding rules"
  type        = map(string)
  default     = {}
}
