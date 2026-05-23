# ローカル開発用 GCS データバケット (CSV/Parquet)
# Postgres・API などローカル動作するサービスは docker-compose 側で管理する。
resource "google_storage_bucket" "data" {
  name                        = var.gcs_bucket_name
  location                    = var.bucket_location
  uniform_bucket_level_access = true
  force_destroy               = true
}
