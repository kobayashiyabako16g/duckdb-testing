# DuckDB Testing

DuckDB と React を使用した CSV データ分析アプリケーションのモノレポプロジェクト。

## アーキテクチャ

```
User → [Cloudflare Access] → Frontend (SPA)
                                   ↓ cf-access-jwt-assertion header
                           API (Cloud Run) [JWT検証 + テナント確認]
                                   ↓ Workload Identity
                           Cloud Storage (GCS)
```

- ユーザー認証は Cloudflare Access が担当
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
DB_PATH=./data/app.db  # オプション (デフォルト: ./data/app.db)
PORT=8080              # オプション (デフォルト: 8080)
```

#### フロントエンド用

`apps/front/config/env/.env` を作成 (`.env.example` を参考):

```env
API_BASE_URL=http://localhost:8080
```

### 6. SQLite DB の初期化

API 初回起動時に自動でスキーマが作成されます。ユーザー・テナントデータは手動で投入してください。

```sql
INSERT INTO tenants (id, name) VALUES ('tenant-001', 'My Tenant');
INSERT INTO users (id, tenant_id, email, role) VALUES ('user-001', 'tenant-001', 'you@example.com', 'viewer');
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
- better-sqlite3 — ユーザー・テナント管理
- jose — Cloudflare Access JWT 検証
- @google-cloud/storage — GCS 署名付き URL 生成

### インフラ

- **Cloud Run** — API ホスティング (ポート 8080)
- **Cloud Storage (GCS)** — CSV/Parquet ファイルの格納
- **Workload Identity** — Cloud Run から GCS へのキーレス認証
- **Cloudflare Access** — ユーザー認証 (Zero Trust)

### Cloud Run デプロイ時の IAM 設定

Service Account に以下のロールを付与:

| ロール | 用途 |
|--------|------|
| `roles/storage.objectViewer` | GCS バケットの読み取り |
| `roles/iam.serviceAccountTokenCreator` | V4 署名付き URL の生成 |

## Docker

```sh
docker build -t duckdb-testing-api .
docker run -p 8080:8080 \
  -e CF_ACCESS_TEAM_DOMAIN=your-team.cloudflareaccess.com \
  -e CF_ACCESS_AUD=your-aud \
  -e GCS_BUCKET_NAME=your-bucket \
  duckdb-testing-api
```

## Lint / フォーマット

```sh
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```
