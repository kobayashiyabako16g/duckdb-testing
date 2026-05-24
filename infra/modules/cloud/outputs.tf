output "cloud_run_url" {
  description = "Cloud Run サービスの URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "artifact_registry_repo" {
  description = "Artifact Registry リポジトリ (docker push 先)"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}/api"
}

output "service_account_email" {
  description = "Cloud Run が使用する Service Account のメールアドレス"
  value       = google_service_account.api.email
}

output "app_url" {
  description = "アプリケーションの URL (Cloudflare Access 経由)"
  value       = "https://${var.app_domain}"
}

output "cf_access_aud" {
  description = "Cloudflare Access Application の AUD タグ (API の CF_ACCESS_AUD に使用)"
  value       = cloudflare_zero_trust_access_application.front.aud
}

output "load_balancer_ip" {
  description = "Cloud Load Balancer の静的 IP (Cloudflare DNS の A レコードに設定)"
  value       = google_compute_global_address.frontend.address
}

output "frontend_bucket_name" {
  description = "フロントエンド静的ファイルをデプロイする GCS バケット名"
  value       = google_storage_bucket.frontend.name
}

# ── Cloud SQL 関連出力 ────────────────────────────────────────

output "cloudsql_instance_name" {
  description = "Cloud SQL インスタンス名"
  value       = google_sql_database_instance.postgres.name
}

output "cloudsql_private_ip" {
  description = "Cloud SQL インスタンスの Private IP アドレス"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "cloudsql_connection_name" {
  description = "Cloud SQL Proxy 接続用の接続名 (project:region:instance)"
  value       = google_sql_database_instance.postgres.connection_name
}

output "cloudsql_database_name" {
  description = "作成されたデータベース名"
  value       = google_sql_database.duckdb_testing.name
}

output "cloudsql_database_user" {
  description = "Cloud SQL のデータベースユーザー名"
  value       = google_sql_user.db_user.name
}

output "cloudsql_database_password_secret_id" {
  description = "Secret Manager に保存されたパスワードのシークレットID"
  value       = google_secret_manager_secret.cloudsql_database_url.secret_id
}
