variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for secret names"
  type        = string
}

variable "service_account_emails" {
  description = "Map of service account emails (server, web)"
  type        = map(string)
}

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default     = {}
}
