# infra

Terraform 定義を **terragrunt** で環境分割している。

## ディレクトリ構成

```
infra/
├── modules/
│   ├── local/         # ローカル開発で必要な最小 GCP リソース (= データ用 GCS バケット)
│   └── cloud/         # 本番相当: Cloud Run / LB / Cloudflare Access / Secret Manager 等
└── live/
    ├── terragrunt.hcl # ルート共通設定 (バックエンド等)
    ├── local/         # local 環境の terragrunt unit
    │   ├── terragrunt.hcl
    │   ├── terraform.tfvars.example
    │   └── terraform.tfvars  (要作成・gitignore)
    └── cloud/         # cloud 環境の terragrunt unit
        ├── terragrunt.hcl
        ├── terraform.tfvars.example
        └── terraform.tfvars  (要作成・gitignore)
```

- **modules** は素の Terraform モジュール。直接 `terraform` を叩く想定ではなく `terragrunt` 経由で利用する。
- **live/\<env\>** は環境ごとの terragrunt unit。`source` でモジュールを参照し、`inputs` と `terraform.tfvars` で値を注入する。

## 前提

```bash
brew install terragrunt   # terraform は terragrunt が依存解決
gcloud auth application-default login
```

## ローカル環境 (local)

ローカル開発は docker-compose (Postgres) + 実 GCS バケットの構成。
Terragrunt で管理するのは以下のみ:

- データ用 GCS バケット (`google_storage_bucket.data`)
- ローカル API 用サービスアカウント (`google_service_account.api_local`)
- バケットの `storage.objectViewer` (SA に付与)
- `iam.serviceAccountTokenCreator` (開発者ユーザー → SA、V4 署名 URL 発行のため)

```bash
cd infra/live/local
cp terraform.tfvars.example terraform.tfvars
# project_id / gcs_bucket_name / developer_principals を埋める

terragrunt init
terragrunt plan
terragrunt apply
```

apply 後、ADC を SA 成り代わりで設定する:

```bash
eval "$(terragrunt output -raw impersonation_login_command)"
# or 出力を見て手動で:
#   gcloud auth application-default login \
#     --impersonate-service-account=duckdb-testing-api-local@<project>.iam.gserviceaccount.com
```

既にバケットがある場合は import:

```bash
terragrunt import google_storage_bucket.data <既存バケット名>
```

## クラウド環境 (cloud)

旧 `infra/terraform.tfvars` は `infra/live/cloud/terraform.tfvars` にそのまま使える。

```bash
cd infra/live/cloud
# 既に terraform.tfvars がある (旧 infra/ から移動済み)

terragrunt init
terragrunt plan
terragrunt apply
```

## 状態保存

デフォルトでは各 unit の `.terragrunt-cache/` 配下にローカル状態が作られる。
GCS バックエンドに切り替える場合は `infra/live/terragrunt.hcl` の `remote_state` ブロックのコメントを外す。

## 既存 state からの移行

旧 `infra/` で `terraform apply` 済みの場合、state ファイル (`terraform.tfstate`) は次のように扱う。

- ローカル state を使い続けるなら、state を新 unit ディレクトリ (`live/cloud/`) にコピーしてから `terragrunt init` する。
- GCS バックエンドに移行するなら、`terraform state push` で remote へ流し込む。
