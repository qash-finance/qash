variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "notification_email" {
  description = "Email address for alert notifications"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications (empty = disabled)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "monitored_services" {
  description = "List of Cloud Run service keys to monitor"
  type        = list(string)
}

variable "cloud_run_service_names" {
  description = "Map of service key → Cloud Run service name"
  type        = map(string)
}

variable "database_instance_name" {
  description = "Cloud SQL instance name for monitoring"
  type        = string
}

variable "labels" {
  description = "Labels to apply to alert policies"
  type        = map(string)
  default     = {}
}
