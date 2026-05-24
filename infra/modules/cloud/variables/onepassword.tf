# ── 1Password 設定 ──────────────────────────────────────────
# 認証は provider 側で環境変数または 1Password app 連携を使用する。
# 例:
#   - OP_SERVICE_ACCOUNT_TOKEN: Service Account 認証
#   - OP_ACCOUNT: 1Password app / CLI 連携時の対象アカウント

variable "onepassword_vault_name" {
  description = "1Password Vault の名前 (Cloud SQL 認証情報を保存するvault)"
  type        = string
  default     = "Terraform"
}
