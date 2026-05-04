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
