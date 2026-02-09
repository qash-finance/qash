output "redis_host" {
  description = "Hostname of the Redis instance"
  value       = google_redis_instance.main.host
}

output "redis_port" {
  description = "Port of the Redis instance"
  value       = google_redis_instance.main.port
}

output "redis_auth_string" {
  description = "AUTH string for the Redis instance"
  value       = google_redis_instance.main.auth_string
  sensitive   = true
}
