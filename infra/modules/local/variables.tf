variable "project_id" {
  description = "GCP プロジェクト ID"
  type        = string
}

variable "region" {
  description = "デプロイリージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "gcs_bucket_name" {
  description = "ローカル開発用に CSV/Parquet ファイルを格納する GCS バケット名"
  type        = string
}

variable "bucket_location" {
  description = "GCS バケットのロケーション"
  type        = string
  default     = "ASIA"
}

variable "service_account_id" {
  description = "ローカル開発用サービスアカウントの account_id (= メールアドレスの @ より前)"
  type        = string
  default     = "duckdb-testing-api-local"
}

variable "developer_principals" {
  description = <<-EOT
    SA に成り代わって署名付き URL を発行できる開発者の IAM プリンシパル。
    例: ["user:alice@example.com", "group:dev-team@example.com"]
  EOT
  type        = list(string)
  default     = []
}
