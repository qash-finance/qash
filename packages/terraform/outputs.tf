# -----------------------------------------------------------------------------
# Service URLs
# -----------------------------------------------------------------------------

output "server_url" {
  description = "URL of the qash-server Cloud Run service"
  value       = module.cloud_run.service_urls["server"]
}

output "web_url" {
  description = "URL of the qash-web Cloud Run service"
  value       = module.cloud_run.service_urls["web"]
}

output "docs_url" {
  description = "URL of the qash-docs Cloud Run service"
  value       = module.cloud_run.service_urls["docs"]
}

# -----------------------------------------------------------------------------
# Load Balancer
# -----------------------------------------------------------------------------

output "load_balancer_ip" {
  description = "Global IP address of the HTTPS load balancer"
  value       = module.load_balancer.load_balancer_ip
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

output "database_connection_name" {
  description = "Cloud SQL instance connection name for Cloud SQL Proxy"
  value       = module.database.instance_connection_name
}

output "database_private_ip" {
  description = "Private IP address of the Cloud SQL instance"
  value       = module.database.private_ip_address
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Cache
# -----------------------------------------------------------------------------

output "redis_host" {
  description = "Memorystore Redis host"
  value       = module.cache.redis_host
  sensitive   = true
}

# -----------------------------------------------------------------------------
# IAM
# -----------------------------------------------------------------------------

output "service_account_emails" {
  description = "Map of service account emails"
  value       = module.iam.service_account_emails
}

output "github_workload_identity_provider" {
  description = "Workload Identity provider for GitHub Actions"
  value       = module.iam.workload_identity_provider
}

# -----------------------------------------------------------------------------
# Artifact Registry
# -----------------------------------------------------------------------------

output "artifact_registry_url" {
  description = "Artifact Registry repository URL"
  value       = module.iam.artifact_registry_url
}
