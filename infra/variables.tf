variable "project_id" {
  description = "GCP プロジェクト ID"
  type        = string
}

variable "region" {
  description = "デプロイリージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "image_tag" {
  description = "デプロイする Docker イメージのタグ"
  type        = string
  default     = "latest"
}

variable "cf_access_team_domain" {
  description = "Cloudflare Access チームドメイン (例: your-team.cloudflareaccess.com)"
  type        = string
}

variable "cf_access_aud" {
  description = "Cloudflare Access Audience (Application Audience Tag)"
  type        = string
  sensitive   = true
}

variable "gcs_bucket_name" {
  description = "CSV/Parquet ファイルを格納する GCS バケット名"
  type        = string
}

variable "database_url" {
  description = "PostgreSQL 接続 URL (例: postgres://user:password@host:5432/dbname)"
  type        = string
  sensitive   = true
}

variable "allow_unauthenticated" {
  description = "Cloud Run への未認証アクセスを許可する。Cloudflare Access で保護する場合は true"
  type        = bool
  default     = true
}

variable "cloud_run_min_instances" {
  description = "Cloud Run の最小インスタンス数 (コールドスタート軽減のため 1 以上を推奨)"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Cloud Run の最大インスタンス数"
  type        = number
  default     = 10
}
