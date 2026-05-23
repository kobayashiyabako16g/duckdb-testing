resource "google_service_account" "api" {
  account_id   = "duckdb-testing-api"
  display_name = "duckdb-testing API Service Account"
}

# GCS バケットの読み取り権限
resource "google_project_iam_member" "api_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# V4 署名付き URL の生成権限
resource "google_project_iam_member" "api_token_creator" {
  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# Secret Manager へのアクセス権限
resource "google_project_iam_member" "api_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# Cloud Run への公開アクセス (allow_unauthenticated = true の場合のみ)
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
