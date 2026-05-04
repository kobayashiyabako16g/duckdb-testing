# グローバル静的 IP アドレス
resource "google_compute_global_address" "frontend" {
  name = "duckdb-testing-ip"
}

# マネージド SSL 証明書 (DNS が IP を向いてから自動プロビジョニング)
resource "google_compute_managed_ssl_certificate" "frontend" {
  name = "duckdb-testing-cert"
  managed {
    domains = [var.app_domain]
  }
}

# Cloud Run 用 Serverless NEG
resource "google_compute_region_network_endpoint_group" "api" {
  name                  = "duckdb-testing-api-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }
}

# Cloud Run バックエンドサービス
resource "google_compute_backend_service" "api" {
  name                  = "duckdb-testing-api-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"
  timeout_sec           = 30

  backend {
    group = google_compute_region_network_endpoint_group.api.id
  }
}

# GCS バックエンドバケット (Cloud CDN 有効)
resource "google_compute_backend_bucket" "frontend" {
  name        = "duckdb-testing-frontend-backend"
  bucket_name = google_storage_bucket.frontend.name
  enable_cdn  = true
}

# URL マップ: /api/* → Cloud Run、/* → GCS (SPA フォールバック)
resource "google_compute_url_map" "main" {
  name            = "duckdb-testing-url-map"
  default_service = google_compute_backend_bucket.frontend.self_link

  host_rule {
    hosts        = [var.app_domain]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_bucket.frontend.self_link

    # /api/* → Cloud Run
    route_rules {
      priority = 1
      match_rules {
        prefix_match = "/api/"
      }
      service = google_compute_backend_service.api.self_link
    }

    # /api (末尾スラッシュなし) → Cloud Run
    route_rules {
      priority = 2
      match_rules {
        full_path_match = "/api"
      }
      service = google_compute_backend_service.api.self_link
    }

    # /assets/* → GCS (ハッシュ付き静的ファイル、リライトなし)
    route_rules {
      priority = 10
      match_rules {
        prefix_match = "/assets/"
      }
      service = google_compute_backend_bucket.frontend.self_link
    }

    # SPA フォールバック: 上記以外はすべて /index.html にリライト
    route_rules {
      priority = 100
      match_rules {
        prefix_match = "/"
      }
      service = google_compute_backend_bucket.frontend.self_link
      route_action {
        url_rewrite {
          path_full_rewrite = "/index.html"
        }
      }
    }
  }
}

# HTTP → HTTPS リダイレクト用 URL マップ
resource "google_compute_url_map" "http_redirect" {
  name = "duckdb-testing-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http_redirect" {
  name    = "duckdb-testing-http-proxy"
  url_map = google_compute_url_map.http_redirect.self_link
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  name                  = "duckdb-testing-http-forwarding-rule"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_http_proxy.http_redirect.self_link
  ip_address            = google_compute_global_address.frontend.address
  port_range            = "80"
}

# HTTPS プロキシ
resource "google_compute_target_https_proxy" "main" {
  name             = "duckdb-testing-https-proxy"
  url_map          = google_compute_url_map.main.self_link
  ssl_certificates = [google_compute_managed_ssl_certificate.frontend.self_link]
}

# HTTPS フォワーディングルール
resource "google_compute_global_forwarding_rule" "main" {
  name                  = "duckdb-testing-https-forwarding-rule"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_https_proxy.main.self_link
  ip_address            = google_compute_global_address.frontend.address
  port_range            = "443"
}
