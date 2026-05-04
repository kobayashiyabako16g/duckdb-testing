# DuckDB Testing

DuckDB と React を使用した CSV データ分析アプリケーションのモノレポプロジェクト。

## アーキテクチャ

![](./infra-architecture.drawio.svg)

```
User
  ↓
[Cloudflare Access]  ← cf-access-jwt-assertion ヘッダー付与
  ↓
[Cloud Load Balancer]  (カスタムドメイン / Cloud CDN)
  ├── /api/*  ─→  Cloud Run  ─→  GCS Bucket [data] (CSV/Parquet)
  └── /*      ─→  GCS Bucket [frontend] (SPA 静的ファイル)
```

- ユーザー認証は Cloudflare Access が担当（JWT を `cf-access-jwt-assertion` ヘッダーで付与）
- フロントエンド（Vite SPA）は GCS バケットにホスティングし、Cloud CDN でキャッシュ
- API は Cloud Run で動作し、Cloud Load Balancer 経由でのみ受信
- CSV/Parquet ファイルは別の GCS バケットに格納し、API 経由で署名付き URL を発行
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

### 3. GCS エミュレータのセットアップ

ローカル開発では `docker compose` に含まれる GCS エミュレータを使用します。ADC や実際の GCS バケットは不要です。

```sh
# docker compose up -d で gcs-emulator も起動します (後述のステップ 7 で実行)
```

#### バケットの作成

エミュレータ起動後、バケットを作成します:

```sh
curl -s -X POST "http://localhost:1324/storage/v1/b?project=local-dev" \
  -H "Content-Type: application/json" \
  -d '{"name":"local-bucket"}' | jq .name
```

#### テストファイルのアップロード

オブジェクトのパス構造:

```
local-bucket/tenant_id={tenant_id}/mock_data.csv
local-bucket/tenant_id={tenant_id}/output.csv
```

```sh
curl -s -X POST \
  "http://localhost:1324/upload/storage/v1/b/local-bucket/o?uploadType=media&name=tenant_id%3Dtenant-001%2Fmock_data.csv" \
  -H "Content-Type: text/csv" \
  --data-binary @./path/to/mock_data.csv
```

> `GCS_EMULATOR_HOST` が設定されている場合、API は署名付き URL の代わりにエミュレータへの直接 URL を返します。

### 4. 環境変数の設定

#### API 用

ルートの `.env` ファイルを作成（`.env` はすでにデフォルト値が入っています）:

```env
APP_ENV=development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app
GCS_BUCKET_NAME=local-bucket
GCS_EMULATOR_HOST=http://localhost:1324
DEV_USER_EMAIL=dev@example.com   # db:seed で作成したユーザーのメールアドレス

# APP_ENV=development の場合は不要
# CF_ACCESS_TEAM_DOMAIN=your-team-name.cloudflareaccess.com
# CF_ACCESS_AUD=your-cloudflare-access-audience
```

> `APP_ENV=development` を設定すると、Cloudflare Access の JWT 検証をスキップして `DEV_USER_EMAIL` のユーザーで認証をバイパスします。

#### フロントエンド用

`apps/front/config/env/.env` を作成 (`.env.example` を参考):

```env
API_BASE_URL=http://localhost:8080
VITE_DEV_MODE=true
```

> `VITE_DEV_MODE=true` を設定すると、CF_Authorization cookie がない場合でも API 呼び出しを行います。

### 5. DB のセットアップ

#### マイグレーションの適用

```sh
pnpm --filter @apps/api db:migrate
```

#### 初期データの投入

```sh
pnpm db:seed
```

または手動で:

```sql
INSERT INTO tenants (id, name) VALUES ('tenant-001', 'My Tenant');
INSERT INTO users (id, tenant_id, email, role) VALUES ('user-001', 'tenant-001', 'dev@example.com', 'viewer');
```

#### スキーマを変更した場合

```sh
# マイグレーションファイルを生成してコミット
pnpm --filter @apps/api db:generate

# 適用
pnpm --filter @apps/api db:migrate
```

## 開発サーバーの起動

```sh
# PostgreSQL + GCS エミュレータを起動
docker compose up -d

# ターミナル 1: API (ポート 8080)
pnpm dev:api

# ターミナル 2: フロントエンド (ポート 5173)
pnpm dev:front
```

ブラウザで `http://localhost:5173` を開くと SPA が表示され、`/api/*` へのリクエストは `http://localhost:8080` へクロスオリジンで転送されます。

| サービス       | URL                       |
| -------------- | ------------------------- |
| フロントエンド | http://localhost:5173     |
| API            | http://localhost:8080     |
| GCS エミュレータ | http://localhost:1324   |

### フロントエンド単体

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

- **Cloud Load Balancer** — グローバル HTTPS ロードバランサー（ルーティング・Cloud CDN）
- **Cloud Storage (GCS)** — フロントエンド SPA のホスティング / CSV・Parquet ファイルの格納
- **Cloud Run** — API ホスティング (ポート 8080)
- **Cloudflare Access** — ユーザー認証 (Zero Trust)
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

`gcloud` / Cloudflare ダッシュボードによる手動作業の代わりに、`infra/` ディレクトリの Terraform 構成で **GCP と Cloudflare Access を一括管理**できます。

#### 管理対象リソース

| ファイル                   | リソース                                        |
| -------------------------- | ----------------------------------------------- |
| `main.tf`                  | Provider (google, cloudflare)・バックエンド設定 |
| `variables.tf`             | 入力変数                                        |
| `outputs.tf`               | 出力値 (URL・IP・AUD など)                      |
| `artifact_registry.tf`     | Artifact Registry リポジトリ                    |
| `iam.tf`                   | Service Account・IAM バインディング             |
| `secrets.tf`               | Secret Manager (DATABASE_URL, CF_ACCESS_AUD)    |
| `cloud_run.tf`             | Cloud Run サービス (API)                        |
| `storage.tf`               | GCS バケット (フロントエンド静的ファイル)       |
| `load_balancer.tf`         | Cloud Load Balancer (IP, SSL, URL マップ, NEG)  |
| `cloudflare_access.tf`     | Cloudflare Access Application + Policy          |
| `terraform.tfvars.example` | 変数ファイルのサンプル                          |

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
load_balancer_ip       = "34.xxx.xxx.xxx"
frontend_bucket_name   = "your-project-id-frontend"
app_url                = "https://app.your-domain.com"
cloud_run_url          = "https://duckdb-testing-api-xxxxxxxxxx-an.a.run.app"
cf_access_aud          = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
artifact_registry_repo = "asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/duckdb-testing/api"
service_account_email  = "duckdb-testing-api@YOUR_PROJECT_ID.iam.gserviceaccount.com"
```

**5. DNS の設定**

Cloudflare ダッシュボード → **DNS** で `app_domain` の A レコードを LB の IP に向けます:

| Type | Name  | Content                   | Proxy            |
| ---- | ----- | ------------------------- | ---------------- |
| A    | `app` | `load_balancer_ip` の値   | Proxied (orange) |

> マネージド SSL 証明書は DNS が反映されてから自動でプロビジョニングされます（10〜15 分）。

**6. フロントエンドのデプロイ**

```sh
# プロジェクトルートで実行
pnpm --filter @apps/front build

BUCKET=$(cd infra && terraform output -raw frontend_bucket_name)
gsutil -m rsync -r -d apps/front/dist gs://${BUCKET}
```

> `gsutil -m rsync` は差分のみアップロードします。初回以降は変更ファイルのみ転送されます。

**7. イメージ更新時の再デプロイ**

```sh
docker build -t "${IMAGE}:latest" .
docker push "${IMAGE}:latest"

cd infra
terraform apply -var="image_tag=latest"
```

> タグを `latest` ではなく Git SHA などに固定すると、同じタグで push しても Cloud Run の revision が更新されないことがあります。その場合は `-var="image_tag=$(git rev-parse --short HEAD)"` のように一意なタグを使用してください。

---

## Cloudflare Access + カスタムドメインの設定

Cloud Load Balancer がフロントと API を一本化し、Cloudflare Access が前段で認証を担います。JWT が `cf-access-jwt-assertion` ヘッダーに付与され、LB 経由で Cloud Run に転送されます。

### 前提条件

Cloudflare Access の `self_hosted` タイプは **Cloudflare DNS でプロキシ中（orange-cloud）のドメイン**が必要です。`terraform apply` で取得した LB の IP を A レコードに設定します。

### 1. Terraform でインフラを作成し LB の IP を取得

```sh
cd infra
terraform apply

terraform output load_balancer_ip
# → 34.xxx.xxx.xxx
```

### 2. Cloudflare DNS の設定

Cloudflare ダッシュボード → **DNS** で A レコードを追加:

| Type | Name  | Content                 | Proxy            |
| ---- | ----- | ----------------------- | ---------------- |
| A    | `app` | `load_balancer_ip` の値 | Proxied (orange) |

> CNAME ではなく **A レコード**を使用してください。Cloud Run の `*.run.app` ではなく LB の IP を向けます。

### 3. SSL 証明書のプロビジョニング確認

マネージド SSL 証明書は DNS 反映後に自動でプロビジョニングされます（10〜15 分）。

```sh
gcloud compute ssl-certificates describe duckdb-testing-cert \
  --global \
  --format="value(managed.status)"
# → ACTIVE になれば完了
```

---

## Docker

API イメージのビルドと動作確認:

```sh
docker build -t duckdb-testing .
docker run -p 8080:8080 \
  -e APP_ENV=development \
  -e GCS_BUCKET_NAME=your-bucket \
  -e DATABASE_URL=postgres://user:password@host:5432/dbname \
  duckdb-testing
```

起動後、`http://localhost:8080/api/me` で API の動作を確認できます。フロントエンドは GCS にホスティングされるため、ローカルで SPA を表示するには `pnpm dev:front` を使用してください。

## Lint / フォーマット

```sh
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```
