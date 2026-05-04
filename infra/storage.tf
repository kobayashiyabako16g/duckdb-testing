# フロントエンド静的ファイル用 GCS バケット
resource "google_storage_bucket" "frontend" {
  name                        = "${var.project_id}-frontend"
  location                    = "ASIA"
  uniform_bucket_level_access = true
  force_destroy               = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

# Cloud Load Balancer からのオブジェクト読み取りを許可
resource "google_storage_bucket_iam_member" "frontend_public" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
