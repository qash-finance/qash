# -----------------------------------------------------------------------------
# Global Static IP
# -----------------------------------------------------------------------------

resource "google_compute_global_address" "main" {
  project = var.project_id
  name    = "${var.name_prefix}-lb-ip"
}

# -----------------------------------------------------------------------------
# Managed SSL Certificate
# -----------------------------------------------------------------------------

resource "google_compute_managed_ssl_certificate" "main" {
  project = var.project_id
  name    = "${var.name_prefix}-ssl-cert"

  managed {
    domains = [var.domain_name]
  }
}

# -----------------------------------------------------------------------------
# Serverless NEGs (one per Cloud Run service)
# -----------------------------------------------------------------------------

resource "google_compute_region_network_endpoint_group" "server" {
  project               = var.project_id
  name                  = "${var.name_prefix}-neg-server"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.cloud_run_services["server"].name
  }
}

resource "google_compute_region_network_endpoint_group" "web" {
  project               = var.project_id
  name                  = "${var.name_prefix}-neg-web"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.cloud_run_services["web"].name
  }
}

resource "google_compute_region_network_endpoint_group" "docs" {
  project               = var.project_id
  name                  = "${var.name_prefix}-neg-docs"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.cloud_run_services["docs"].name
  }
}

# -----------------------------------------------------------------------------
# Backend Services
# -----------------------------------------------------------------------------

resource "google_compute_backend_service" "server" {
  project               = var.project_id
  name                  = "${var.name_prefix}-backend-server"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.server.id
  }

  enable_cdn = false # API responses should not be cached

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  security_policy = google_compute_security_policy.main.id
}

resource "google_compute_backend_service" "web" {
  project               = var.project_id
  name                  = "${var.name_prefix}-backend-web"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.web.id
  }

  enable_cdn = var.cdn_enabled

  dynamic "cdn_policy" {
    for_each = var.cdn_enabled ? [1] : []
    content {
      cache_mode                   = "USE_ORIGIN_HEADERS"
      default_ttl                  = 3600
      max_ttl                      = 86400
      serve_while_stale            = 86400
      signed_url_cache_max_age_sec = 0
    }
  }

  log_config {
    enable      = true
    sample_rate = 0.5
  }

  security_policy = google_compute_security_policy.main.id
}

resource "google_compute_backend_service" "docs" {
  project               = var.project_id
  name                  = "${var.name_prefix}-backend-docs"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.docs.id
  }

  enable_cdn = var.cdn_enabled

  dynamic "cdn_policy" {
    for_each = var.cdn_enabled ? [1] : []
    content {
      cache_mode                   = "USE_ORIGIN_HEADERS"
      default_ttl                  = 3600
      max_ttl                      = 86400
      serve_while_stale            = 86400
      signed_url_cache_max_age_sec = 0
    }
  }

  log_config {
    enable      = true
    sample_rate = 0.5
  }

  security_policy = google_compute_security_policy.main.id
}

# -----------------------------------------------------------------------------
# URL Map (routing rules)
# -----------------------------------------------------------------------------

resource "google_compute_url_map" "main" {
  project         = var.project_id
  name            = "${var.name_prefix}-url-map"
  default_service = google_compute_backend_service.web.id

  host_rule {
    hosts        = [var.domain_name]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.web.id

    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.server.id
    }

    path_rule {
      paths   = ["/docs", "/docs/*"]
      service = google_compute_backend_service.docs.id
    }
  }
}

# -----------------------------------------------------------------------------
# HTTPS Proxy + Forwarding Rule
# -----------------------------------------------------------------------------

resource "google_compute_target_https_proxy" "main" {
  project          = var.project_id
  name             = "${var.name_prefix}-https-proxy"
  url_map          = google_compute_url_map.main.id
  ssl_certificates = [google_compute_managed_ssl_certificate.main.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  project               = var.project_id
  name                  = "${var.name_prefix}-https-rule"
  target                = google_compute_target_https_proxy.main.id
  ip_address            = google_compute_global_address.main.address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  labels                = var.labels
}

# -----------------------------------------------------------------------------
# HTTP → HTTPS redirect
# -----------------------------------------------------------------------------

resource "google_compute_url_map" "http_redirect" {
  project = var.project_id
  name    = "${var.name_prefix}-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  project = var.project_id
  name    = "${var.name_prefix}-http-redirect-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  project               = var.project_id
  name                  = "${var.name_prefix}-http-redirect-rule"
  target                = google_compute_target_http_proxy.redirect.id
  ip_address            = google_compute_global_address.main.address
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  labels                = var.labels
}

# -----------------------------------------------------------------------------
# Cloud Armor Security Policy
# -----------------------------------------------------------------------------

resource "google_compute_security_policy" "main" {
  project = var.project_id
  name    = "${var.name_prefix}-security-policy"

  # Default allow rule
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }

  # Rate limiting: 100 requests per minute per IP
  rule {
    action   = "rate_based_ban"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      ban_duration_sec = 300
    }
    description = "Rate limit: 100 req/min per IP"
  }

  # Block known bad bots / scanners
  rule {
    action   = "deny(403)"
    priority = "900"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block XSS attacks"
  }

  rule {
    action   = "deny(403)"
    priority = "901"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL injection attacks"
  }
}
