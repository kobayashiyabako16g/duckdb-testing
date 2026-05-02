locals {
  image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}/api:${var.image_tag}"
}

resource "google_cloud_run_v2_service" "api" {
  name     = "duckdb-testing-api"
  location = var.region

  deletion_protection = false

  template {
    service_account = google_service_account.api.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = local.image

      ports {
        container_port = 8080
      }

      # 非機密環境変数
      env {
        name  = "CF_ACCESS_TEAM_DOMAIN"
        value = var.cf_access_team_domain
      }

      env {
        name  = "GCS_BUCKET_NAME"
        value = var.gcs_bucket_name
      }

      # Secret Manager から注入する機密環境変数
      env {
        name = "CF_ACCESS_AUD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.cf_access_aud.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }
  # depends_on でシークレットバージョンを指定しない。
  # secret_key_ref はシークレットリソース名のみ参照するため、バージョンの作成順序を強制すると
  # cloudflare_pages_project → cloud_run → secret_version → access_app → pages という循環依存になる。
  # Terraform apply 内でシークレットバージョンは後から作成されるが、Cloud Run は起動時に
  # version = "latest" を動的に解決するため運用上の問題はない。
}
