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

# ── Cloudflare ──────────────────────────────────────────────

variable "cloudflare_api_token" {
  description = "Cloudflare API トークン (Pages・Access・DNS 編集権限が必要)"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare アカウント ID"
  type        = string
}

variable "app_domain" {
  description = "Cloudflare Access で保護するカスタムドメイン (例: app.your-domain.com)。Cloudflare DNS でプロキシ有効が必要"
  type        = string
}

variable "cloudflare_allowed_email_domains" {
  description = "Cloudflare Access でアクセスを許可するメールドメインのリスト"
  type        = list(string)
}
