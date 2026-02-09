output "vpc_id" {
  description = "Self-link of the VPC network"
  value       = google_compute_network.main.id
}

output "vpc_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.main.name
}

output "private_subnet_id" {
  description = "Self-link of the private subnet"
  value       = google_compute_subnetwork.private.id
}

output "vpc_connector_id" {
  description = "Fully qualified ID of the Serverless VPC Access Connector"
  value       = google_vpc_access_connector.main.id
}

output "private_vpc_connection" {
  description = "The private VPC connection for Cloud SQL"
  value       = google_service_networking_connection.private_vpc_connection
}
