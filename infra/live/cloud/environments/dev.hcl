# 開発環境専用設定
# usage: terragrunt plan --terragrunt-config-file environments/dev.hcl

locals {
  environment = "dev"
  enable_auto_start_stop = true   # 開発環境は自動停止有効（コスト削減）
  cloud_run_min_instances = 0     # 最小インスタンス数（スケールダウン）
}
