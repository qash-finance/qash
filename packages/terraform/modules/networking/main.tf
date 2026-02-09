# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------

resource "google_compute_network" "main" {
  project                 = var.project_id
  name                    = "${var.name_prefix}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

# -----------------------------------------------------------------------------
# Private subnet for Cloud SQL / Redis
# -----------------------------------------------------------------------------

resource "google_compute_subnetwork" "private" {
  project                  = var.project_id
  name                     = "${var.name_prefix}-private"
  region                   = var.region
  network                  = google_compute_network.main.id
  ip_cidr_range            = "10.0.0.0/20"
  private_ip_google_access = true
}

# -----------------------------------------------------------------------------
# Private Service Access (Cloud SQL private IP)
# -----------------------------------------------------------------------------

resource "google_compute_global_address" "private_ip_range" {
  project       = var.project_id
  name          = "${var.name_prefix}-private-ip-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# -----------------------------------------------------------------------------
# Serverless VPC Access Connector (Cloud Run → private network)
# -----------------------------------------------------------------------------

resource "google_vpc_access_connector" "main" {
  project       = var.project_id
  name          = "${var.name_prefix}-connector"
  region        = var.region
  ip_cidr_range = var.ip_cidr_range
  network       = google_compute_network.main.name

  min_throughput = 200
  max_throughput = 300
}

# -----------------------------------------------------------------------------
# Cloud Router + NAT (outbound internet for Cloud Run via VPC connector)
# -----------------------------------------------------------------------------

resource "google_compute_router" "main" {
  project = var.project_id
  name    = "${var.name_prefix}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  project = var.project_id
  name    = "${var.name_prefix}-nat"
  router  = google_compute_router.main.name
  region  = var.region

  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# -----------------------------------------------------------------------------
# Firewall – allow internal traffic within VPC
# -----------------------------------------------------------------------------

resource "google_compute_firewall" "allow_internal" {
  project = var.project_id
  name    = "${var.name_prefix}-allow-internal"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
}
