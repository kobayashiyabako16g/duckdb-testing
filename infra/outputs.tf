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
