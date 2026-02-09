# -----------------------------------------------------------------------------
# Secret Manager Secrets
# -----------------------------------------------------------------------------

locals {
  # All secrets that need to be created.
  # Values are populated manually after first apply via:
  #   gcloud secrets versions add <SECRET_ID> --data-file=-
  secrets = toset([
    "database-password", # Auto-populated by database module
    "jwt-secret",
    "jwt-refresh-secret",
    "mailgun-api-key",
    "para-api-key",
    "redis-auth-string",
    "supabase-storage-endpoint",
    "supabase-access-key-id",
    "supabase-secret-access-key",
    "miden-server-url",
  ])

  # Map of which service accounts can access which secrets
  server_secrets = toset([
    "database-password",
    "jwt-secret",
    "jwt-refresh-secret",
    "mailgun-api-key",
    "para-api-key",
    "redis-auth-string",
    "supabase-storage-endpoint",
    "supabase-access-key-id",
    "supabase-secret-access-key",
    "miden-server-url",
  ])

  web_secrets = toset([
    "para-api-key",
  ])
}

# -----------------------------------------------------------------------------
# Create Secrets
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "secrets" {
  for_each = local.secrets

  project   = var.project_id
  secret_id = "${var.name_prefix}-${each.key}"

  replication {
    auto {}
  }

  labels = var.labels
}

# -----------------------------------------------------------------------------
# IAM – qash-server can access its secrets
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret_iam_member" "server_access" {
  for_each = local.server_secrets

  project   = var.project_id
  secret_id = google_secret_manager_secret.secrets[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.service_account_emails["server"]}"
}

# -----------------------------------------------------------------------------
# IAM – qash-web can access its secrets
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret_iam_member" "web_access" {
  for_each = local.web_secrets

  project   = var.project_id
  secret_id = google_secret_manager_secret.secrets[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.service_account_emails["web"]}"
}
