include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

terraform {
  source = "${get_repo_root()}/infra/modules/local"

  # 既存の terraform.tfvars をこのディレクトリに置けば自動で読み込まれる。
  # 値の優先順位: inputs (このファイル) < terraform.tfvars。
  extra_arguments "tfvars" {
    commands = ["plan", "apply", "destroy", "import", "refresh", "console"]
    optional_var_files = [
      "${get_terragrunt_dir()}/terraform.tfvars",
    ]
  }
}

# 必須変数のうち、環境ごとに固定したい既定値は inputs で与える。
# 機密値 (なし) や開発者固有の値は terraform.tfvars でオーバーライドする。
inputs = {
  region          = "asia-northeast1"
  bucket_location = "ASIA"
}
