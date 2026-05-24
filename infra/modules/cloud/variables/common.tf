# ── 共通設定 ────────────────────────────────────────────────

variable "image_tag" {
  description = "デプロイする Docker イメージのタグ"
  type        = string
  default     = "latest"
}

variable "gcs_bucket_name" {
  description = "CSV/Parquet ファイルを格納する GCS バケット名"
  type        = string
}
