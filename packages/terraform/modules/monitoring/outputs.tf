output "dashboard_id" {
  description = "ID of the monitoring dashboard"
  value       = google_monitoring_dashboard.main.id
}

output "alert_policy_ids" {
  description = "Alert policy IDs"
  value = merge(
    { for k, v in google_monitoring_alert_policy.high_error_rate : "error-rate-${k}" => v.name },
    {
      high_latency     = google_monitoring_alert_policy.high_latency.name
      db_high_cpu      = google_monitoring_alert_policy.db_high_cpu.name
      instance_scaling = google_monitoring_alert_policy.instance_scaling.name
    }
  )
}

output "notification_channel_ids" {
  description = "Notification channel IDs"
  value       = local.notification_channels
}
