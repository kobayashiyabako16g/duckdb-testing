# ── Cloud Run 設定 ──────────────────────────────────────────

variable "allow_unauthenticated" {
  description = "Cloud Run への未認証アクセスを許可する。Cloudflare Access で保護する場合は true"
  type        = bool
  default     = true
}

variable "cloud_run_min_instances" {
  description = "Cloud Run の最小インスタンス数 (コールドスタート軽減のため 1 以上を推奨)"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Cloud Run の最大インスタンス数"
  type        = number
  default     = 10
}
