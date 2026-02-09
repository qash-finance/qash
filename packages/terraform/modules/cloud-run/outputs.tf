output "service_urls" {
  description = "Map of service name → Cloud Run service URL"
  value = {
    server = google_cloud_run_v2_service.server.uri
    web    = google_cloud_run_v2_service.web.uri
    docs   = google_cloud_run_v2_service.docs.uri
  }
}

output "service_names" {
  description = "Map of service name → Cloud Run service name"
  value = {
    server = google_cloud_run_v2_service.server.name
    web    = google_cloud_run_v2_service.web.name
    docs   = google_cloud_run_v2_service.docs.name
  }
}
