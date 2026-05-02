# Secret リソースの作成
resource "google_secret_manager_secret" "cf_access_aud" {
  secret_id = "cf-access-aud"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url"

  replication {
    auto {}
  }
}

# Secret の値を登録
# 注意: sensitive な値が tfstate に保存されます。
#       本番環境では CI/CD や gcloud CLI で別途管理することを推奨します。
# AUD は cloudflare_access_application から自動取得 (手動入力不要)
resource "google_secret_manager_secret_version" "cf_access_aud" {
  secret      = google_secret_manager_secret.cf_access_aud.id
  secret_data = cloudflare_zero_trust_access_application.front.aud
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = var.database_url
}
