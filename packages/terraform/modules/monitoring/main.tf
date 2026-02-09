# -----------------------------------------------------------------------------
# Notification Channels
# -----------------------------------------------------------------------------

resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "${var.name_prefix} Email Alerts"
  type         = "email"

  labels = {
    email_address = var.notification_email
  }
}

resource "google_monitoring_notification_channel" "slack" {
  count = var.slack_webhook_url != "" ? 1 : 0

  project      = var.project_id
  display_name = "${var.name_prefix} Slack Alerts"
  type         = "slack"

  labels = {
    channel_name = "#qash-alerts"
  }

  sensitive_labels {
    auth_token = var.slack_webhook_url
  }
}

locals {
  notification_channels = concat(
    [google_monitoring_notification_channel.email.name],
    var.slack_webhook_url != "" ? [google_monitoring_notification_channel.slack[0].name] : []
  )
}

# -----------------------------------------------------------------------------
# Uptime Checks (one per service)
# -----------------------------------------------------------------------------

resource "google_monitoring_uptime_check_config" "services" {
  for_each = toset(var.monitored_services)

  project      = var.project_id
  display_name = "${var.name_prefix}-${each.key}-uptime"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path           = each.key == "server" ? "/health" : "/"
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
  }

  monitored_resource {
    type = "cloud_run_revision"
    labels = {
      project_id   = var.project_id
      service_name = var.cloud_run_service_names[each.key]
      location     = "asia-southeast1"
    }
  }
}

# -----------------------------------------------------------------------------
# Alert Policy – High Error Rate (5xx > 5% for 5 min)
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "high_error_rate" {
  for_each = toset(var.monitored_services)

  project      = var.project_id
  display_name = "${var.name_prefix}-${each.key}-high-error-rate"
  combiner     = "OR"

  conditions {
    display_name = "5xx error rate > 5%"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "${var.cloud_run_service_names[each.key]}"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.labels.response_code_class = "5xx"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# -----------------------------------------------------------------------------
# Alert Policy – High Latency (p95 > 2s for 5 min)
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "high_latency" {
  project      = var.project_id
  display_name = "${var.name_prefix}-server-high-latency"
  combiner     = "OR"

  conditions {
    display_name = "P95 latency > 2s"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "${var.cloud_run_service_names["server"]}"
        AND metric.type = "run.googleapis.com/request_latencies"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 2000 # milliseconds
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# -----------------------------------------------------------------------------
# Alert Policy – Cloud SQL High CPU
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "db_high_cpu" {
  project      = var.project_id
  display_name = "${var.name_prefix}-db-high-cpu"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL CPU > 80%"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloudsql_database"
        AND resource.labels.database_id = "${var.project_id}:${var.database_instance_name}"
        AND metric.type = "cloudsql.googleapis.com/database/cpu/utilization"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# -----------------------------------------------------------------------------
# Alert Policy – Cloud Run Instance Count at Max
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "instance_scaling" {
  project      = var.project_id
  display_name = "${var.name_prefix}-server-at-max-instances"
  combiner     = "OR"

  conditions {
    display_name = "Server instance count approaching max"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "${var.cloud_run_service_names["server"]}"
        AND metric.type = "run.googleapis.com/container/instance_count"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 8 # Alert when approaching max of 10
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# -----------------------------------------------------------------------------
# Dashboard
# -----------------------------------------------------------------------------

resource "google_monitoring_dashboard" "main" {
  project = var.project_id
  dashboard_json = jsonencode({
    displayName = "${var.name_prefix} Overview"
    gridLayout = {
      columns = 2
      widgets = concat(
        # Request count per service
        [for svc in var.monitored_services : {
          title = "${svc} – Request Rate"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.cloud_run_service_names[svc]}\" AND metric.type = \"run.googleapis.com/request_count\""
                  aggregation = {
                    alignmentPeriod  = "60s"
                    perSeriesAligner = "ALIGN_RATE"
                  }
                }
              }
            }]
          }
        }],
        # Latency per service
        [for svc in var.monitored_services : {
          title = "${svc} – P95 Latency"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.cloud_run_service_names[svc]}\" AND metric.type = \"run.googleapis.com/request_latencies\""
                  aggregation = {
                    alignmentPeriod  = "60s"
                    perSeriesAligner = "ALIGN_PERCENTILE_95"
                  }
                }
              }
            }]
          }
        }],
        # Database CPU
        [{
          title = "Cloud SQL – CPU Utilization"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.database_instance_name}\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\""
                  aggregation = {
                    alignmentPeriod  = "60s"
                    perSeriesAligner = "ALIGN_MEAN"
                  }
                }
              }
            }]
          }
        }],
        # Database connections
        [{
          title = "Cloud SQL – Active Connections"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.database_instance_name}\" AND metric.type = \"cloudsql.googleapis.com/database/postgresql/num_backends\""
                  aggregation = {
                    alignmentPeriod  = "60s"
                    perSeriesAligner = "ALIGN_MEAN"
                  }
                }
              }
            }]
          }
        }]
      )
    }
  })
}
