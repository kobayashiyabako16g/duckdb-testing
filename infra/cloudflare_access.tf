# Cloudflare Access Application (Cloud Run を保護)
resource "cloudflare_zero_trust_access_application" "front" {
  account_id       = var.cloudflare_account_id
  name             = "duckdb-testing"
  # Cloudflare DNS で管理・プロキシ中（orange-cloud）のカスタムドメイン
  domain           = var.app_domain
  type             = "self_hosted"
  session_duration = "24h"

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
