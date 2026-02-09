# -----------------------------------------------------------------------------
# Service Accounts – one per Cloud Run service (least privilege)
# -----------------------------------------------------------------------------

resource "google_service_account" "server" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-server-sa"
  display_name = "Qash Server Service Account"
}

resource "google_service_account" "web" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-web-sa"
  display_name = "Qash Web Service Account"
}

resource "google_service_account" "docs" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-docs-sa"
  display_name = "Qash Docs Service Account"
}

# -----------------------------------------------------------------------------
# Server SA permissions
# -----------------------------------------------------------------------------

resource "google_project_iam_member" "server_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.server.email}"
}

resource "google_project_iam_member" "server_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.server.email}"
}

resource "google_project_iam_member" "server_monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.server.email}"
}

resource "google_project_iam_member" "server_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.server.email}"
}

# -----------------------------------------------------------------------------
# Web SA permissions
# -----------------------------------------------------------------------------

resource "google_project_iam_member" "web_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.web.email}"
}

resource "google_project_iam_member" "web_monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.web.email}"
}

resource "google_project_iam_member" "web_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.web.email}"
}

# -----------------------------------------------------------------------------
# Docs SA permissions (minimal – static content only)
# -----------------------------------------------------------------------------

resource "google_project_iam_member" "docs_monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.docs.email}"
}

resource "google_project_iam_member" "docs_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.docs.email}"
}

# -----------------------------------------------------------------------------
# Artifact Registry – container image storage
# -----------------------------------------------------------------------------

resource "google_artifact_registry_repository" "main" {
  project       = var.project_id
  location      = "asia-southeast1"
  repository_id = "${var.name_prefix}-containers"
  description   = "Docker container images for Qash services"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  labels = var.labels
}

# -----------------------------------------------------------------------------
# Workload Identity Federation – GitHub Actions → GCP
# -----------------------------------------------------------------------------

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "${var.name_prefix}-github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Workload Identity Pool for GitHub Actions CI/CD"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_org}/${var.github_repo}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# CI/CD service account used by GitHub Actions
resource "google_service_account" "cicd" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-cicd-sa"
  display_name = "Qash CI/CD Service Account"
}

# Allow GitHub Actions to impersonate the CI/CD service account
resource "google_service_account_iam_member" "cicd_workload_identity" {
  service_account_id = google_service_account.cicd.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_org}/${var.github_repo}"
}

# CI/CD SA permissions
resource "google_project_iam_member" "cicd_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_project_iam_member" "cicd_artifact_registry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_project_iam_member" "cicd_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}
