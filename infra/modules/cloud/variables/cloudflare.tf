# ── Cloudflare 設定 ────────────────────────────────────────

variable "cf_access_team_domain" {
  description = "Cloudflare Access チームドメイン (例: your-team.cloudflareaccess.com)"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API トークン (Pages・Access・DNS 編集権限が必要)"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare アカウント ID"
  type        = string
}

variable "app_domain" {
  description = "Cloudflare Access で保護するカスタムドメイン (例: app.your-domain.com)。Cloudflare DNS でプロキシ有効が必要"
  type        = string
}

variable "cloudflare_allowed_email_domains" {
  description = "Cloudflare Access でアクセスを許可するメールドメインのリスト"
  type        = list(string)
}

# ── Google OAuth (Cloudflare Access の Identity Provider 用) ─

variable "google_oauth_client_id" {
  description = "Cloudflare Access の Google IdP で使用する OAuth Client ID"
  type        = string
  default     = ""
}

variable "google_oauth_client_secret" {
  description = "Cloudflare Access の Google IdP で使用する OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}
