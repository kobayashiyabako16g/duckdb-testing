# infra

Terraform 定義を **terragrunt** で環境分割している。

## ディレクトリ構成

```
infra/
├── modules/
│   ├── local/                   # ローカル開発リソース
│   └── cloud/                   # クラウド環境リソース
│       ├── main.tf              # Terraform 要件定義（簡潔化）
│       ├── providers.tf         # プロバイダー設定（分離）
│       ├── variables/           # 関心事別に分割された変数定義
│       │   ├── gcp.tf
│       │   ├── common.tf
│       │   ├── cloud_run.tf
│       │   ├── cloud_sql.tf
│       │   ├── cloudflare.tf
│       │   └── onepassword.tf
│       ├── cloud_run.tf
│       ├── cloud_sql.tf
│       ├── cloudflare_access.tf
│       ├── iam.tf
│       └── outputs.tf
└── live/
    ├── terragrunt.hcl           # ルート共通設定
    ├── local/                   # local 環境の terragrunt unit
    │   ├── terragrunt.hcl
    │   ├── terraform.tfvars.example
    │   └── terraform.tfvars     (要作成・gitignore)
    └── cloud/                   # cloud 環境の terragrunt unit
        ├── terragrunt.hcl       # 環境別設定対応
        ├── terraform.tfvars.example
        ├── terraform.tfvars     (要作成・gitignore)
        ├── terraform-dev.tfvars.example
        ├── terraform-prod.tfvars.example
        └── environments/
            ├── dev.hcl          # 開発環境設定
            └── prod.hcl         # 本番環境設定
```

### 改善点

1. **Variables の関心事別分割** (`variables/` ディレクトリ)
   - 各プロバイダー・機能ごとに変数を分割
   - 関連する変数の管理が容易に
   - 新規変数追加時の編集範囲を限定

2. **Provider 設定の分離** (`providers.tf`)
   - `main.tf` は Terraform 要件定義のみ
   - プロバイダー設定を独立させて保守性向上

3. **環境別設定の強化** (`environments/` ディレクトリ)
   - 開発環境と本番環境で異なる設定を明示
   - 環境変数 `ENVIRONMENT` で簡単に切り替え可能

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

### 基本的な実行方法（開発環境）

```bash
cd infra/live/cloud

# 初回セットアップ
# 1Password app にサインインしておく
# 必要なら対象アカウントを指定
# export OP_ACCOUNT="my.1password.com"
# op account list
terragrunt init

# 開発環境で実行（デフォルト）
terragrunt plan
terragrunt apply
```

### 環境別での実行

#### 開発環境での実行

```bash
cd infra/live/cloud

# 明示的に開発環境を指定
ENVIRONMENT=dev terragrunt plan
ENVIRONMENT=dev terragrunt apply
```

**開発環境の特性:**

- Cloud SQL: 自動停止・起動有効（昼間のみ稼働）
- Cloud Run: 最小インスタンス 0（コールドスタート許容）
- 目的: コスト最小化

#### 本番環境での実行

```bash
cd infra/live/cloud

# 本番環境を指定（重要：必ず指定する）
ENVIRONMENT=prod terragrunt plan
ENVIRONMENT=prod terragrunt apply
```

**本番環境の特性:**

- Cloud SQL: 常時稼働（自動停止無効）
- Cloud Run: 最小インスタンス 2（HA構成）
- 目的: 可用性・パフォーマンス重視

### 環境別設定ファイル

環境別の既定値を override する場合：

```bash
# 開発環境
terragrunt plan --var-file terraform-dev.tfvars

# 本番環境
terragrunt plan --var-file terraform-prod.tfvars
```

詳細は `terraform-dev.tfvars.example` / `terraform-prod.tfvars.example` を参照。

## 状態保存

デフォルトでは各 unit の `.terragrunt-cache/` 配下にローカル状態が作られる。
GCS バックエンドに切り替える場合は `infra/live/terragrunt.hcl` の `remote_state` ブロックのコメントを外す。

## 既存 state からの移行

旧 `infra/` で `terraform apply` 済みの場合、state ファイル (`terraform.tfstate`) は次のように扱う。

- ローカル state を使い続けるなら、state を新 unit ディレクトリ (`live/cloud/`) にコピーしてから `terragrunt init` する。
- GCS バックエンドに移行するなら、`terraform state push` で remote へ流し込む。

## Cloud SQL (PostgreSQL) - 最小コスト構成

`cloud` 環境では、開発・検証用の最小スペック Cloud SQL PostgreSQL を構築しています。

### 構成の特徴

| 項目               | 設定                        | 月額費用削減効果              |
| ------------------ | --------------------------- | ----------------------------- |
| **Machine Type**   | `db-f1-micro` (共有コア)    | 基本料金 ￥1,000〜2,000       |
| **初期ストレージ** | 10 GB                       | 最小構成でスタート            |
| **自動拡張**       | ON (最大 100GB)             | 必要に応じて自動増加          |
| **バックアップ**   | 1 世代のみ保持              | 最小化                        |
| **自動停止・起動** | Cloud Scheduler + Workflows | **稼働していない時間は 0 円** |

### 自動停止・起動 (非稼働時間の節減)

Cloud Scheduler が **毎日朝 7 時に起動、夜 22 時に停止** するよう自動で管理します。

- **スケジュール**: 毎日（土日も含む）
- **起動**: 22:00 UTC (= 朝 7:00 JST)
- **停止**: 13:00 UTC (= 夜 22:00 JST)
- **有効/無効**: `terraform.tfvars` 内の `enable_auto_start_stop = true` で制御

例: インスタンス代を約 42% 削減可能 (月 3,000 円 → 1,740 円 / 15 時間/日稼働の場合)

```hcl
# infra/live/cloud/terraform.tfvars
enable_auto_start_stop = true  # Cloud Scheduler を有効化
# enable_auto_start_stop = false # Cloud Scheduler を無効化（本番用）
```

### Database 情報

- **インスタンス名**: `duckdb-testing-db`
- **Database**: `duckdb_testing` (デフォルト、変更可)
- **ユーザー**: `duckdb_user` (デフォルト、変更可)
- **接続**: Private IP (VPC ピアリング経由)
  - Cloud Run から内部的にアクセス可能
  - 外部からは Cloud SQL Proxy 経由でのみアクセス可

```bash
# Cloud SQL Proxy 経由のローカル接続例
cloud_sql_proxy -instances=<project>:asia-northeast1:duckdb-testing-db=tcp:5432 &
psql -h 127.0.0.1 -U duckdb_user -d duckdb_testing
```

### Secret Manager

データベース接続情報は Secret Manager に保存され、Cloud Run の環境変数 `DATABASE_URL` として自動注入されます。

- **Secret ID**: `cloudsql-database-url`
- **中身**: `postgresql://duckdb_user:PASSWORD@PRIVATE_IP:5432/duckdb_testing?sslmode=require`

## 1Password 統合 - パスワード・機密情報の安全な管理

Cloud SQL のデータベースパスワード、その他の機密情報は **1Password Terraform Provider** で管理され、Terraform State には平文で保存されません。

### 前提条件

1. **1Password アカウント** が必要
2. **1Password app** または **op CLI** でサインイン済みであること
3. **1Password Vault** に "Cloud SQL - duckdb-testing" という Database アイテムを作成

### 1Password app / op CLI の準備

```bash
# 1. 1Password app にサインイン
# 2. op CLI を使う場合はログイン
#    app 連携が有効なら account list だけで確認できる
op account list

# 3. CLI セッションが必要な環境ではログイン情報を shell に反映
#    例: eval $(op signin)
#    複数アカウントがある場合: eval $(op signin --account my.1password.com)
#
# 4. 複数アカウントがある場合だけ対象アカウントを指定
export OP_ACCOUNT="my.1password.com"
```

### 1Password Vault への Database アイテム作成

1Password アプリで以下のように設定します：

- **Item Type**: Database
- **Name**: `Cloud SQL - duckdb-testing`
- **Database Type**: PostgreSQL
- **Username**: `duckdb_user` (またはカスタマイズ)
- **Password**: (自動生成 or 手動設定)

### Terraform 実行

```bash
cd infra/live/cloud

# 1Password app にサインイン済み、または op CLI でログイン済みの状態で実行
# 複数アカウントがある場合のみ OP_ACCOUNT を指定
# export OP_ACCOUNT="my.1password.com"
# 必要なら先に: eval $(op signin)

terragrunt plan
terragrunt apply
```

### Terraform State の保護

- パスワードは **1Password** に保存され、State には記録されない
- State ファイルを誤ってコミットしても、パスワードは含まれない
- `sensitive = true` の変数として管理

### 補足

- Terraform Provider は `op` コマンド自体で直接認証するわけではなく、1Password app 連携または環境変数ベースで認証する。
- `op` CLI はサインイン確認や `OP_ACCOUNT` の選定、必要に応じた shell セッション作成に使うのが実用的。
- Service Account 認証を残したい場合も、`providers.tf` の `provider "onepassword" {}` は `OP_SERVICE_ACCOUNT_TOKEN` を自動で読める。

**参考**: https://www.1password.dev/terraform

## 保守性ガイドライン

### Variables の追加・編集

- `variables.tf` は参照用ドキュメント（実際の定義は `variables/` ディレクトリ）
- 新規変数は関心事に応じて該当ファイルに追加
  - GCP 関連 → `variables/gcp.tf`
  - Cloud SQL 関連 → `variables/cloud_sql.tf`
  - Cloudflare 関連 → `variables/cloudflare.tf`
  - その他 → `variables/common.tf`

### Provider 追加時

1. `required_providers` ブロックを `main.tf` に追加
2. `provider` ブロックを `providers.tf` に追加
3. 対応する変数を `variables/<provider>.tf` に作成

### 環境別設定の使い分け

| 環境     | 用途                    | 実行方法                           |
| -------- | ----------------------- | ---------------------------------- |
| **dev**  | ローカル検証・CI テスト | `terragrunt plan` (デフォルト)     |
| **prod** | 本番環境                | `ENVIRONMENT=prod terragrunt plan` |

### .gitignore 設定

以下のファイルは `.gitignore` に追加：

```gitignore
infra/live/cloud/terraform.tfvars
infra/live/cloud/terraform-dev.tfvars
infra/live/cloud/terraform-prod.tfvars
infra/live/cloud/.terragrunt-cache/
```
