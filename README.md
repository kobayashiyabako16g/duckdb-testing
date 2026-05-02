# DuckDB Testing

DuckDB と React を使用した CSV データ分析アプリケーションのモノレポプロジェクト。

## アーキテクチャ

![](./infra-architecture.drawio.svg)

```
User → [Cloudflare Access] → Cloud Run (カスタムドメイン)
              ↓                    ├── /*         Frontend SPA (静的ファイル)
    cf-access-jwt-assertion        ├── /assets/*  静的アセット
                                   └── /api/*     JWT検証 + API ロジック
                                         ↓ Workload Identity
                                   Cloud Storage (GCS)
```

- ユーザー認証は Cloudflare Access が担当（JWT を `cf-access-jwt-assertion` ヘッダーで付与）
- フロントエンド（Vite SPA）と API を同一の Cloud Run コンテナで serve
- CSV/Parquet ファイルは GCS に格納し、API 経由で署名付き URL を発行
- フロントエンドは署名付き URL を使って DuckDB WASM でブラウザ内クエリを実行

## 必要な環境

- **Node.js**: v20 以上 (推奨: v24)
- **pnpm**: v10.32.1 以上
- **Google Cloud SDK** (`gcloud`): GCS アクセス用

### オプション (推奨)

- **devenv**: Nix ベースの開発環境管理ツール ([インストール方法](https://devenv.sh/getting-started/))

## セットアップ

### 1. リポジトリのクローン

```sh
git clone https://github.com/yourusername/duckdb-testing.git
cd duckdb-testing
```

### 2. 依存関係のインストール

#### devenv を使用する場合 (推奨)

```sh
devenv shell
```

#### 手動でセットアップする場合

```sh
pnpm install
```

### 3. GCS 認証のセットアップ

ローカル開発では Application Default Credentials (ADC) を使用します。

```sh
gcloud auth application-default login
```

### 4. GCS バケットの準備

GCS バケットを作成し、CSV/Parquet ファイルをアップロードします。

オブジェクトのパス構造:

```
gs://{BUCKET_NAME}/tenant_id={tenant_id}/mock_data.csv
gs://{BUCKET_NAME}/tenant_id={tenant_id}/output.csv
```

ローカル実行時はバケットへの読み取り権限が ADC に付与されている必要があります。

### 5. 環境変数の設定

#### API 用

ルートの `.env` ファイルを作成:

```env
CF_ACCESS_TEAM_DOMAIN=your-team-name.cloudflareaccess.com
CF_ACCESS_AUD=your-cloudflare-access-audience
GCS_BUCKET_NAME=your-gcs-bucket-name
DATABASE_URL=postgres://user:password@localhost:5432/dbname
PORT=8080  # オプション (デフォルト: 8080)
```

#### フロントエンド用

`apps/front/config/env/.env` を作成 (`.env.example` を参考):

```env
API_BASE_URL=http://localhost:8080
```

### 6. DB のセットアップ

#### マイグレーションの適用

```sh
pnpm --filter @apps/api db:migrate
```

#### 初期データの投入

```sql
INSERT INTO tenants (id, name) VALUES ('tenant-001', 'My Tenant');
INSERT INTO users (id, tenant_id, email, role) VALUES ('user-001', 'tenant-001', 'you@example.com', 'viewer');
```

#### スキーマを変更した場合

```sh
# マイグレーションファイルを生成してコミット
pnpm --filter @apps/api db:generate

# 適用
pnpm --filter @apps/api db:migrate
```

> **ローカル実行の制約**: API の認証は Cloudflare Access の JWT に依存しているため、フロントエンド → API の完全なフローをローカルで実行するには Cloudflare Access の環境が必要です。API 単体のテストには `cf-access-jwt-assertion` ヘッダーを手動で付与してください。

## 開発サーバーの起動

### フロントエンド

```sh
pnpm dev:front
```

### API

```sh
pnpm dev:api
```

## ビルド

```sh
pnpm build:front
pnpm build:api
```

## プロジェクト構成

```
.
├── apps/
│   ├── api/         # Hono ベースの API サーバー (Cloud Run)
│   └── front/       # React + Vite フロントエンド (DuckDB WASM)
├── Dockerfile       # API 用 (Cloud Run デプロイ向け)
├── devenv.nix       # devenv 設定
├── turbo.json       # Turborepo 設定
└── package.json     # ルート設定
```

## 使用技術

### フロントエンド

- React 19
- Vite 8
- DuckDB WASM — ブラウザ内で SQL クエリを実行
- TanStack Router
- Tailwind CSS 4

### API

- Hono
- Drizzle ORM + postgres.js — ユーザー・テナント管理 (PostgreSQL)
- jose — Cloudflare Access JWT 検証
- @google-cloud/storage — GCS 署名付き URL 生成

### インフラ

- **Cloudflare Pages** — フロントエンド (SPA) ホスティング・CDN
- **Cloudflare Access** — ユーザー認証 (Zero Trust)
- **Cloud Run** — API ホスティング (ポート 8080)
- **Cloud Storage (GCS)** — CSV/Parquet ファイルの格納
- **Workload Identity** — Cloud Run から GCS へのキーレス認証

### Cloud Run デプロイ時の IAM 設定

Service Account に以下のロールを付与:

| ロール                                 | 用途                   |
| -------------------------------------- | ---------------------- |
| `roles/storage.objectViewer`           | GCS バケットの読み取り |
| `roles/iam.serviceAccountTokenCreator` | V4 署名付き URL の生成 |

## Cloud Run デプロイ (API)

### 前提条件

- Google Cloud SDK (`gcloud`) がインストール済みで、対象プロジェクトにログイン済み
- Docker がインストール済み
- `GOOGLE_CLOUD_PROJECT` に GCP プロジェクト ID が設定済み

```sh
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 1. Artifact Registry の準備

Docker イメージの保存先として Artifact Registry リポジトリを作成します。

```sh
gcloud artifacts repositories create duckdb-testing \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="duckdb-testing API images"
```

Docker 認証の設定:

```sh
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```

### 2. Docker イメージのビルドとプッシュ

```sh
IMAGE="asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/duckdb-testing/api"

docker build -t "${IMAGE}:latest" .
docker push "${IMAGE}:latest"
```

### 3. Service Account の作成

```sh
gcloud iam service-accounts create duckdb-testing-api \
  --display-name="duckdb-testing API Service Account"
```

以下のロールを付与します（「Cloud Run デプロイ時の IAM 設定」を参照）:

```sh
SA="duckdb-testing-api@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# GCS バケットの読み取り
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/storage.objectViewer"

# V4 署名付き URL の生成
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/iam.serviceAccountTokenCreator"
```

### 4. Cloud Run へのデプロイ

```sh
SA="duckdb-testing-api@YOUR_PROJECT_ID.iam.gserviceaccount.com"
IMAGE="asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/duckdb-testing/api:latest"

gcloud run deploy duckdb-testing-api \
  --image="${IMAGE}" \
  --region=asia-northeast1 \
  --platform=managed \
  --service-account="${SA}" \
  --port=8080 \
  --set-env-vars="CF_ACCESS_TEAM_DOMAIN=your-team.cloudflareaccess.com" \
  --set-env-vars="CF_ACCESS_AUD=your-aud" \
  --set-env-vars="GCS_BUCKET_NAME=your-bucket" \
  --set-env-vars="DATABASE_URL=postgres://user:password@host:5432/dbname" \
  --no-allow-unauthenticated
```

> `--no-allow-unauthenticated` により、Cloud Run の認証レイヤーも有効にできます。Cloudflare Access のみで保護する場合は `--allow-unauthenticated` に変更してください。

デプロイ後、表示される Service URL が API のエンドポイントになります。

### 5. 環境変数の更新

デプロイ後に環境変数を追加・変更する場合:

```sh
gcloud run services update duckdb-testing-api \
  --region=asia-northeast1 \
  --set-env-vars="KEY=VALUE"
```

Secret Manager を使う場合 (推奨):

```sh
# Secret を作成
echo -n "your-database-url" | gcloud secrets create DATABASE_URL --data-file=-

# Cloud Run サービスに紐付け
gcloud run services update duckdb-testing-api \
  --region=asia-northeast1 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest"

# Service Account に Secret へのアクセス権を付与
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor"
```

### 6. DB マイグレーション

Cloud Run はリクエスト駆動のため、マイグレーションはデプロイとは別に実行します。

#### ローカルから直接実行 (Cloud SQL Proxy 経由)

Cloud SQL を使用している場合:

```sh
# Cloud SQL Auth Proxy を起動
cloud-sql-proxy YOUR_PROJECT_ID:asia-northeast1:YOUR_INSTANCE &

# マイグレーション実行
DATABASE_URL=postgres://user:password@localhost:5432/dbname \
  pnpm --filter @apps/api db:migrate
```

#### Cloud Run Jobs を使う場合

```sh
gcloud run jobs create db-migrate \
  --image="${IMAGE}" \
  --region=asia-northeast1 \
  --service-account="${SA}" \
  --set-env-vars="DATABASE_URL=postgres://..." \
  --command="node" \
  --args="dist/migrate.js"

# 実行
gcloud run jobs execute db-migrate --region=asia-northeast1
```

### 7. カスタムドメイン (オプション)

```sh
gcloud run domain-mappings create \
  --service=duckdb-testing-api \
  --domain=api.your-domain.com \
  --region=asia-northeast1
```

DNS の TXT/CNAME レコードを指示に従って設定してください。

### Terraform を使う場合

`gcloud` / Cloudflare ダッシュボードによる手動作業の代わりに、`infra/` ディレクトリの Terraform 構成で **GCP (Cloud Run) と Cloudflare (Pages + Access) を一括管理**できます。

#### 管理対象リソース

| ファイル | リソース |
| -------- | -------- |
| `main.tf` | Provider (google, cloudflare)・バックエンド設定 |
| `variables.tf` | 入力変数 |
| `outputs.tf` | 出力値 (URL・AUD など) |
| `artifact_registry.tf` | Artifact Registry リポジトリ |
| `iam.tf` | Service Account・IAM バインディング |
| `secrets.tf` | Secret Manager (DATABASE_URL, CF_ACCESS_AUD) |
| `cloud_run.tf` | Cloud Run サービス |
| `cloudflare_access.tf` | Cloudflare Access Application + Policy |
| `terraform.tfvars.example` | 変数ファイルのサンプル |

#### 値の自動連携

Terraform が以下を自動的に接続するため、手動コピーは不要です:

```
cloudflare_zero_trust_access_application.front.aud
  └─→ google_secret_manager_secret_version.cf_access_aud (Secret Manager)
        └─→ Cloud Run の CF_ACCESS_AUD 環境変数
```

#### 前提条件

- Cloudflare API トークンの作成
  Cloudflare ダッシュボード → **My Profile → API Tokens → Create Token**
  必要な権限: `Access: Apps and Policies:Edit`, `Account Settings:Read`

- カスタムドメインの準備
  Cloudflare で管理しているドメインが必要です（「Cloudflare Access + カスタムドメインの設定」を参照）

#### 手順

**1. 変数ファイルの作成**

```sh
cd infra
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars を編集して実際の値を設定
```

**2. 初期化**

```sh
terraform init
```

GCS をリモートバックエンドにする場合は `main.tf` の `backend "gcs"` ブロックのコメントを外してから実行してください。

**3. Docker イメージのビルドとプッシュ**

Terraform でインフラを作成した後、イメージをプッシュします。

```sh
# Artifact Registry リポジトリのみ先に作成
terraform apply -target=google_artifact_registry_repository.api

# Docker 認証
gcloud auth configure-docker asia-northeast1-docker.pkg.dev

# イメージのビルドとプッシュ (プロジェクトルートで実行)
cd ..
IMAGE=$(cd infra && terraform output -raw artifact_registry_repo)
docker build -t "${IMAGE}:latest" .
docker push "${IMAGE}:latest"
```

**4. インフラ全体のデプロイ**

```sh
cd infra
terraform apply
```

完了後、以下のように出力されます:

```
Outputs:
cloud_run_url          = "https://duckdb-testing-api-xxxxxxxxxx-an.a.run.app"
pages_url              = "https://duckdb-testing.pages.dev"
cf_access_aud          = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
artifact_registry_repo = "asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/duckdb-testing/api"
service_account_email  = "duckdb-testing-api@YOUR_PROJECT_ID.iam.gserviceaccount.com"
```

**5. イメージ更新時の再デプロイ**

```sh
docker build -t "${IMAGE}:latest" .
docker push "${IMAGE}:latest"

cd infra
terraform apply -var="image_tag=latest"
```

> タグを `latest` ではなく Git SHA などに固定すると、同じタグで push しても Cloud Run の revision が更新されないことがあります。その場合は `-var="image_tag=$(git rev-parse --short HEAD)"` のように一意なタグを使用してください。

---

## Cloudflare Access + カスタムドメインの設定

フロントエンドと API は同一の Cloud Run コンテナで提供されます。Cloudflare Access が前段で認証を担い、JWT を `cf-access-jwt-assertion` ヘッダーに付与してリクエストを転送します。

### 前提条件

Cloudflare Access の `self_hosted` タイプは **Cloudflare DNS でプロキシ中（orange-cloud）のドメイン**が必要です。Cloud Run のデフォルト URL (`*.run.app`) は直接使用できないため、カスタムドメインを設定します。

### 1. Cloud Run へのカスタムドメイン設定

```sh
gcloud run domain-mappings create \
  --service=duckdb-testing-api \
  --domain=app.your-domain.com \
  --region=asia-northeast1
```

表示される検証用 TXT レコードと CNAME を次のステップで Cloudflare に設定します。

### 2. Cloudflare DNS の設定

Cloudflare ダッシュボード → **DNS** で以下を追加:

| Type | Name | Content | Proxy |
| ---- | ---- | ------- | ----- |
| TXT | `app` | （gcloud が表示した検証レコード） | DNS only |
| CNAME | `app` | `ghs.googlehosted.com` | Proxied (orange) |

### 3. Cloudflare Access Application の設定（Terraform）

Terraform が `cloudflare_zero_trust_access_application` リソースでカスタムドメインを保護します（`infra/cloudflare_access.tf`）。`app_domain` 変数にカスタムドメインを設定してください。

```sh
cd infra
terraform apply
```

---

## Docker

フロントエンドと API を同一イメージでビルドします。

```sh
docker build -t duckdb-testing .
docker run -p 8080:8080 \
  -e CF_ACCESS_TEAM_DOMAIN=your-team.cloudflareaccess.com \
  -e CF_ACCESS_AUD=your-aud \
  -e GCS_BUCKET_NAME=your-bucket \
  -e DATABASE_URL=postgres://user:password@host:5432/dbname \
  duckdb-testing
```

起動後、`http://localhost:8080` でフロントエンド SPA にアクセスできます（ローカルでは Cloudflare Access なしのため `/api/*` は 401 を返します）。

## Lint / フォーマット

```sh
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```
