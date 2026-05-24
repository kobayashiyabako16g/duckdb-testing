# 1Password Vault を取得
data "onepassword_vault" "terraform" {
  name = var.onepassword_vault_name
}

# 1Password から Cloud SQL 認証情報を取得
# 事前に 1Password 内に以下の Database アイテムを作成してください：
#   - Title: "Cloud SQL - duckdb-testing"
#   - Category: Database
#   - Type: PostgreSQL
#   - Hostname: (テンプレート化または手動入力)
#   - Username: duckdb_user (またはカスタマイズ)
#   - Password: (1Passwordで自動生成または手動設定)
#
# または、以下の resource で Terraform から作成することもできます。
data "onepassword_item" "cloudsql" {
  vault = data.onepassword_vault.terraform.uuid
  title = "Cloud SQL - duckdb-testing"
}

# Cloud SQL インスタンス（最小スペック構成）
resource "google_sql_database_instance" "postgres" {
  name             = "duckdb-testing-db"
  database_version = "POSTGRES_15"
  region           = var.region
  deletion_protection = false

  # 最小スペック・最小コスト構成
  settings {
    tier              = "db-f1-micro"  # 共有コア（最安）
    availability_type = "ZONAL"        # 高可用性なし（開発環境向け）
    disk_type         = "PD_SSD"
    disk_size         = 10             # 初期サイズ 10GB（最小）
    disk_autoresize   = true           # 自動拡張 ON
    disk_autoresize_limit = 100        # 最大 100GB まで自動拡張

    # バックアップ設定：最小化
    backup_configuration {
      enabled  = true
      start_time = "03:00"  # UTC 3:00 (JPT 12:00)
      location = var.region
      backup_retention_settings {
        retained_backups = 1  # 1世代のみ保持（最小）
        retention_unit   = "COUNT"
      }
    }

    # IP ホワイトリスト：Cloud Run からのアクセスのみ
    ip_configuration {
      require_ssl       = true
      ipv4_enabled      = true
      private_network   = google_compute_network.default.id
      enable_private_path_import = false

      # Cloud Shell / 一時的なテスト用（本番は削除推奨）
      authorized_networks {
        name  = "office"
        value = "0.0.0.0/0"  # TODO: 本番環境では制限してください
      }
    }

    # バックアップウィンドウ・メンテナンスウィンドウ
    maintenance_window {
      day          = 1  # 月曜
      hour         = 4  # UTC 4:00 (JPT 13:00)
      update_track = "stable"
    }

    # ロギング設定
    database_flags {
      name  = "log_statement"
      value = "all"
    }
  }

  depends_on = [
    google_service_networking_connection.private_vpc_connection
  ]
}

# Database の作成
resource "google_sql_database" "duckdb_testing" {
  name     = var.database_name
  instance = google_sql_database_instance.postgres.name
  charset  = "UTF8"
  collation = "en_US.UTF8"
}

# データベースユーザー作成
# パスワードは 1Password から取得
resource "google_sql_user" "db_user" {
  name       = data.onepassword_item.cloudsql.username
  instance   = google_sql_database_instance.postgres.name
  password   = data.onepassword_item.cloudsql.password
  type       = "BUILT_IN"
}

# Secret Manager に DATABASE_URL を保存（Cloud Run が使用）
resource "google_secret_manager_secret" "cloudsql_database_url" {
  secret_id = "cloudsql-database-url"
}

resource "google_secret_manager_secret_version" "cloudsql_database_url" {
  secret      = google_secret_manager_secret.cloudsql_database_url.id
  secret_data = format(
    "postgresql://%s:%s@%s:5432/%s?sslmode=require",
    google_sql_user.db_user.name,
    google_sql_user.db_user.password,
    google_sql_database_instance.postgres.private_ip_address,
    google_sql_database.duckdb_testing.name
  )
}

# VPC ピアリング（Private IP 接続用）
resource "google_compute_network" "default" {
  name                    = "duckdb-testing-network"
  auto_create_subnetworks = true
}

resource "google_compute_global_address" "private_ip_address" {
  name          = "duckdb-testing-private-ip"
  address_type  = "INTERNAL"
  address_family = "IPV4"
  purpose       = "VPC_PEERING"
  prefix_length = 16
  network       = google_compute_network.default.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.default.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}
