# -----------------------------------------------------------------------------
# Memorystore Redis Instance
# -----------------------------------------------------------------------------

resource "google_redis_instance" "main" {
  project        = var.project_id
  name           = "${var.name_prefix}-redis"
  region         = var.region
  tier           = var.tier
  memory_size_gb = var.memory_size_gb
  redis_version  = "REDIS_7_2"

  authorized_network = var.vpc_network_id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 18 # 2 AM SGT
        minutes = 0
      }
    }
  }

  redis_configs = {
    maxmemory-policy       = "allkeys-lru"
    notify-keyspace-events = ""
  }

  labels = var.labels
}
