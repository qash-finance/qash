output "load_balancer_ip" {
  description = "Global static IP address of the HTTPS load balancer"
  value       = google_compute_global_address.main.address
}

output "ssl_certificate_name" {
  description = "Name of the managed SSL certificate"
  value       = google_compute_managed_ssl_certificate.main.name
}

output "backend_service_ids" {
  description = "Map of backend service IDs"
  value = {
    server = google_compute_backend_service.server.id
    web    = google_compute_backend_service.web.id
    docs   = google_compute_backend_service.docs.id
  }
}

output "security_policy_name" {
  description = "Name of the Cloud Armor security policy"
  value       = google_compute_security_policy.main.name
}
