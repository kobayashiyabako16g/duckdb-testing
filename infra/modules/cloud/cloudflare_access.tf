# Google を Identity Provider として登録 (Cloudflare Zero Trust)
# google_oauth_client_id が空のときは作成しない。
resource "cloudflare_zero_trust_access_identity_provider" "google" {
  count      = var.google_oauth_client_id == "" ? 0 : 1
  account_id = var.cloudflare_account_id
  name       = "Google"
  type       = "google"
  config = {
    client_id     = var.google_oauth_client_id
    client_secret = var.google_oauth_client_secret
  }
}

# Cloudflare Access Application (Cloud Run を保護)
resource "cloudflare_zero_trust_access_application" "front" {
  account_id       = var.cloudflare_account_id
  name             = "duckdb-testing"
  # Cloudflare DNS で管理・プロキシ中（orange-cloud）のカスタムドメイン
  domain           = var.app_domain
  type             = "self_hosted"
  session_duration = "24h"

  # Google IdP を登録した場合のみ allowed_idps に含める
  allowed_idps = var.google_oauth_client_id == "" ? null : [
    cloudflare_zero_trust_access_identity_provider.google[0].id,
  ]

  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.front_allow.id
      precedence = 1
    }
  ]
}

# アクセスポリシー: 許可するメールドメインを指定
resource "cloudflare_zero_trust_access_policy" "front_allow" {
  account_id = var.cloudflare_account_id
  name       = "Allow allowed email domains"
  decision   = "allow"

  include = [
    for domain in var.cloudflare_allowed_email_domains : {
      email_domain = { domain = domain }
    }
  ]
}
