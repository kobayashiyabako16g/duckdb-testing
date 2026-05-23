# ローカル開発で署名付き URL 発行に使うサービスアカウント。
# ローカルでは ADC = 開発者個人の gcloud 認証 だが、V4 署名付き URL は
# iamcredentials.signBlob を経由するため、SA への成り代わり権限が必要。
#
# 使い方:
#   gcloud auth application-default login \
#     --impersonate-service-account=$(terragrunt output -raw service_account_email)
resource "google_service_account" "api_local" {
  account_id   = var.service_account_id
  display_name = "duckdb-testing API (local dev)"
}

# データバケットの読み取り権限 (バケットスコープに限定)
resource "google_storage_bucket_iam_member" "api_local_object_viewer" {
  bucket = google_storage_bucket.data.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.api_local.email}"
}

# 署名付き URL 用に signBlob を呼べるようにする
resource "google_service_account_iam_member" "api_local_token_creator_self" {
  service_account_id = google_service_account.api_local.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.api_local.email}"
}

# 開発者ユーザー (またはグループ) が SA に成り代われるようにする
resource "google_service_account_iam_member" "api_local_developer_token_creator" {
  for_each           = toset(var.developer_principals)
  service_account_id = google_service_account.api_local.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = each.value
}
