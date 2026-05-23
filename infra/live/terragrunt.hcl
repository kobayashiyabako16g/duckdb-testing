# ルート terragrunt 設定
# 子 unit (live/<env>/terragrunt.hcl) から include "root" で参照される共通設定。
#
# 各環境ごとに `infra/live/<env>/` 配下で `terragrunt apply` を実行する。
#   - local: ローカル開発用 (GCS データバケットのみ)
#   - cloud: 本番相当 (Cloud Run / LB / Cloudflare Access / Secret Manager 等)
#
# 状態保存はデフォルトでローカルファイル (各 unit の .terragrunt-cache 配下) に置く。
# GCS バックエンドに切り替える場合は下部の remote_state ブロックのコメントを外す。

locals {
  # 環境名 (local / cloud) を子 unit のディレクトリ名から導出
  env = basename(get_terragrunt_dir())
}

# GCS バックエンドを使いたい場合に有効化する
#
# remote_state {
#   backend = "gcs"
#   generate = {
#     path      = "backend.tf"
#     if_exists = "overwrite_terragrunt"
#   }
#   config = {
#     bucket   = "your-tfstate-bucket"
#     prefix   = "duckdb-testing/${local.env}"
#     location = "asia-northeast1"
#   }
# }
