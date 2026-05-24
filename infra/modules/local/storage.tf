# ローカル開発用 GCS データバケット (CSV/Parquet)
# Postgres・API などローカル動作するサービスは docker-compose 側で管理する。
resource "google_storage_bucket" "data" {
  name                        = var.gcs_bucket_name
  location                    = var.bucket_location
  uniform_bucket_level_access = true
  force_destroy               = true

  # ブラウザ (Vite dev server) から署名付き URL 経由で CSV を取得できるようにする
  cors {
    origin = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]
    method = ["GET", "HEAD", "OPTIONS", "PUT"]
    response_header = [
      "Content-Type",
      "Content-Length",
      "ETag",
      "Accept-Ranges",
      "Content-Range",
    ]
    max_age_seconds = 3600
  }
}
