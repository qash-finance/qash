output "instance_connection_name" {
  description = "Cloud SQL instance connection name for Cloud SQL Proxy"
  value       = google_sql_database_instance.main.connection_name
}

output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "private_ip_address" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  description = "Name of the database"
  value       = google_sql_database.main.name
}

output "database_user" {
  description = "Database username"
  value       = google_sql_user.main.name
}

output "read_replica_ip" {
  description = "Private IP of the read replica (if created)"
  value       = var.read_replica ? google_sql_database_instance.read_replica[0].private_ip_address : null
}
