# -----------------------------------------------------------------------------
# Cloud SQL PostgreSQL Instance
# -----------------------------------------------------------------------------

resource "google_sql_database_instance" "main" {
  project          = var.project_id
  name             = "${var.name_prefix}-pg"
  region           = var.region
  database_version = "POSTGRES_16"

  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = var.disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network_id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "18:00" # 2 AM SGT (UTC+8)
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 18 # 2 AM SGT
      update_track = "stable"
    }

    database_flags {
      name  = "max_connections"
      value = var.max_connections
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000" # Log queries > 1s
    }

    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 4096
      record_application_tags = true
      record_client_address   = false
    }

    user_labels = var.labels
  }

  lifecycle {
    prevent_destroy = false
  }
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

resource "google_sql_database" "main" {
  project  = var.project_id
  name     = "qash"
  instance = google_sql_database_instance.main.name
}

# -----------------------------------------------------------------------------
# Database User (password from Secret Manager)
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = var.db_password_secret
  secret_data = random_password.db_password.result
}

resource "google_sql_user" "main" {
  project  = var.project_id
  name     = "qash"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result

  deletion_policy = "ABANDON"
}

# -----------------------------------------------------------------------------
# Read Replica (optional)
# -----------------------------------------------------------------------------

resource "google_sql_database_instance" "read_replica" {
  count = var.read_replica ? 1 : 0

  project              = var.project_id
  name                 = "${var.name_prefix}-pg-replica"
  region               = var.region
  database_version     = "POSTGRES_16"
  master_instance_name = google_sql_database_instance.main.name

  replica_configuration {
    failover_target = false
  }

  settings {
    tier            = var.tier
    disk_size       = var.disk_size
    disk_type       = "PD_SSD"
    disk_autoresize = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network_id
    }

    user_labels = merge(var.labels, {
      role = "read-replica"
    })
  }

  lifecycle {
    prevent_destroy = false
  }
}
