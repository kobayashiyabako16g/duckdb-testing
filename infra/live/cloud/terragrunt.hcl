include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

terraform {
  source = "${get_repo_root()}/infra/modules/cloud"

  # 既存の terraform.tfvars をこのディレクトリに置けば自動で読み込まれる。
  # 旧 infra/terraform.tfvars を infra/live/cloud/terraform.tfvars に移動すれば移行完了。
  extra_arguments "tfvars" {
    commands = ["plan", "apply", "destroy", "import", "refresh", "console"]
    optional_var_files = [
      "${get_terragrunt_dir()}/terraform.tfvars",
    ]
  }
}

# 環境固定の既定値のみ inputs で与える。機密値・プロジェクト固有値は terraform.tfvars 側。
inputs = {
  region                  = "asia-northeast1"
  image_tag               = "latest"
  allow_unauthenticated   = true
  cloud_run_min_instances = 0
  cloud_run_max_instances = 10
}
