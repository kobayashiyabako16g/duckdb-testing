# 本番環境専用設定
# usage: terragrunt plan --terragrunt-config-file environments/prod.hcl

locals {
  environment = "prod"
  enable_auto_start_stop = false  # 本番環境は常時稼働（自動停止無効）
  cloud_run_min_instances = 2     # HA構成（最小 2 インスタンス）
}
