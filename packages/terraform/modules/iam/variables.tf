variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "github_org" {
  description = "GitHub organization name"
  type        = string
  default     = "qash-finance"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "qash"
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}
