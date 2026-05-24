# ── Cloud SQL (PostgreSQL) 設定 ─────────────────────────────

variable "database_name" {
  description = "Cloud SQL に作成するデータベース名"
  type        = string
  default     = "duckdb_testing"
}

variable "database_user" {
  description = "Cloud SQL のデータベースユーザー名"
  type        = string
  default     = "duckdb_user"
}

variable "enable_auto_start_stop" {
  description = "Cloud Scheduler による Cloud SQL インスタンスの自動起動・停止を有効にするか"
  type        = bool
  default     = true
}
