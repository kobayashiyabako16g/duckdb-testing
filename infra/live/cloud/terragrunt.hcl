include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

# 環境別設定の読み込み（デフォルト: dev）
# 本番環境で実行: terragrunt run-all plan -var-file terraform-prod.tfvars
# または環境変数で制御: ENVIRONMENT=prod
locals {
  # 環境名（デフォルト: dev）
  environment = get_env("ENVIRONMENT", "dev")

  # 環境別の設定を動的に読み込み
  environment_config = try(
    read_terragrunt_config("${path_relative_to_include()}/${local.environment}.tfvars"),
    {}
  )

  # デフォルト値（開発環境最適化）
  defaults = {
    enable_auto_start_stop = true
    cloud_run_min_instances = 0
  }
}

terraform {
  source = "${get_repo_root()}/infra/modules/cloud"

  # infra/live/cloud/terraform.tfvars に配置。
  extra_arguments "tfvars" {
    commands = ["plan", "apply", "destroy", "import", "refresh", "console"]
    optional_var_files = [
      "${get_terragrunt_dir()}/terraform.tfvars",
    ]
  }
}

# 環境固定の既定値のみ inputs で与える。機密値・プロジェクト固有値は terraform.tfvars 側。
# 環境別に異なる値は環境変数 ENVIRONMENT で切り替え可能
inputs = {
  region                  = "asia-northeast1"
  image_tag               = "latest"
  allow_unauthenticated   = true
  cloud_run_min_instances = local.defaults.cloud_run_min_instances  # 環境別に異なる
  cloud_run_max_instances = 10
  database_name           = "duckdb_testing"
  database_user           = "duckdb_user"
  enable_auto_start_stop  = local.defaults.enable_auto_start_stop  # 環境別に異なる
}
