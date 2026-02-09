output "service_account_emails" {
  description = "Map of service name → service account email"
  value = {
    server = google_service_account.server.email
    web    = google_service_account.web.email
    docs   = google_service_account.docs.email
    cicd   = google_service_account.cicd.email
  }
}

output "workload_identity_provider" {
  description = "Workload Identity provider name for GitHub Actions"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "artifact_registry_url" {
  description = "Artifact Registry repository URL"
  value       = "${google_artifact_registry_repository.main.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}
