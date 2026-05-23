output "data_bucket_name" {
  description = "ローカル開発で使用する GCS データバケット名"
  value       = google_storage_bucket.data.name
}

output "data_bucket_url" {
  description = "GCS データバケットの gs:// URL"
  value       = google_storage_bucket.data.url
}

output "service_account_email" {
  description = "ローカル API がローカル実行時に成り代わるサービスアカウント"
  value       = google_service_account.api_local.email
}

output "impersonation_login_command" {
  description = "ADC を SA 成り代わりで設定する gcloud コマンド"
  value       = "gcloud auth application-default login --impersonate-service-account=${google_service_account.api_local.email}"
}
