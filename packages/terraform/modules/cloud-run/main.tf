# -----------------------------------------------------------------------------
# Cloud Run – qash-server (NestJS API)
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "server" {
  project  = var.project_id
  name     = "${var.name_prefix}-server"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = var.labels

  template {
    labels                           = var.labels
    service_account                  = var.server_service_account_email
    max_instance_request_concurrency = 80
    timeout                          = "300s"

    scaling {
      min_instance_count = var.server_min_instances
      max_instance_count = var.server_max_instances
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.server_image

      ports {
        container_port = 4001
      }

      resources {
        limits = {
          cpu    = var.server_cpu
          memory = var.server_memory
        }
        cpu_idle          = false
        startup_cpu_boost = true
      }

      # Plain environment variables
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "4001"
      }

      env {
        name  = "DATABASE_HOST"
        value = var.database_private_ip
      }

      env {
        name  = "DATABASE_PORT"
        value = "5432"
      }

      env {
        name  = "DATABASE_NAME"
        value = var.database_name
      }

      env {
        name  = "DATABASE_USER"
        value = "qash"
      }

      env {
        name  = "POSTGRES_DB_SSL"
        value = "true"
      }

      env {
        name  = "REDIS_HOST"
        value = var.redis_host
      }

      env {
        name  = "REDIS_PORT"
        value = tostring(var.redis_port)
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      env {
        name  = "FRONTEND_URL"
        value = "https://${var.domain_name}"
      }

      # Secrets from Secret Manager
      env {
        name = "DATABASE_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["database-password"]
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["jwt-secret"]
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_REFRESH_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["jwt-refresh-secret"]
            version = "latest"
          }
        }
      }

      env {
        name = "MAILGUN_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["mailgun-api-key"]
            version = "latest"
          }
        }
      }

      env {
        name = "PARA_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["para-api-key"]
            version = "latest"
          }
        }
      }

      env {
        name = "REDIS_AUTH_STRING"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["redis-auth-string"]
            version = "latest"
          }
        }
      }

      env {
        name = "S3_ENDPOINT"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["supabase-storage-endpoint"]
            version = "latest"
          }
        }
      }

      env {
        name = "S3_ACCESS_KEY_ID"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["supabase-access-key-id"]
            version = "latest"
          }
        }
      }

      env {
        name = "S3_SECRET_ACCESS_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["supabase-secret-access-key"]
            version = "latest"
          }
        }
      }

      env {
        name = "MIDEN_SERVER_URL"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["miden-server-url"]
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 4001
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
        timeout_seconds       = 5
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 4001
        }
        period_seconds    = 30
        failure_threshold = 3
        timeout_seconds   = 5
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Allow unauthenticated traffic (load balancer handles auth)
resource "google_cloud_run_v2_service_iam_member" "server_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# -----------------------------------------------------------------------------
# Cloud Run – qash-web (Next.js frontend)
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "web" {
  project  = var.project_id
  name     = "${var.name_prefix}-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = var.labels

  template {
    labels                           = var.labels
    service_account                  = var.web_service_account_email
    max_instance_request_concurrency = 100
    timeout                          = "60s"

    scaling {
      min_instance_count = var.web_min_instances
      max_instance_count = var.web_max_instances
    }

    containers {
      image = var.web_image

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = var.web_cpu
          memory = var.web_memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "https://${var.domain_name}/api"
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      env {
        name = "NEXT_PUBLIC_PARA_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["para-api-key"]
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/"
          port = 3000
        }
        initial_delay_seconds = 3
        period_seconds        = 5
        failure_threshold     = 3
        timeout_seconds       = 3
      }

      liveness_probe {
        http_get {
          path = "/"
          port = 3000
        }
        period_seconds    = 30
        failure_threshold = 3
        timeout_seconds   = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# -----------------------------------------------------------------------------
# Cloud Run – qash-docs (Docusaurus)
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "docs" {
  project  = var.project_id
  name     = "${var.name_prefix}-docs"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = var.labels

  template {
    labels                           = var.labels
    service_account                  = var.docs_service_account_email
    max_instance_request_concurrency = 250
    timeout                          = "30s"

    scaling {
      min_instance_count = var.docs_min_instances
      max_instance_count = var.docs_max_instances
    }

    containers {
      image = var.docs_image

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = var.docs_cpu
          memory = var.docs_memory
        }
        cpu_idle          = true
        startup_cpu_boost = false
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      startup_probe {
        http_get {
          path = "/"
          port = 3000
        }
        initial_delay_seconds = 2
        period_seconds        = 5
        failure_threshold     = 3
        timeout_seconds       = 3
      }

      liveness_probe {
        http_get {
          path = "/"
          port = 3000
        }
        period_seconds    = 60
        failure_threshold = 3
        timeout_seconds   = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service_iam_member" "docs_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.docs.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
