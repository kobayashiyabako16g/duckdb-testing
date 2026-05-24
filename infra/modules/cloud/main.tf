terraform {
  required_version = ">= 1.14"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.30.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.19.1"
    }
    onepassword = {
      source  = "1Password/onepassword"
      version = "~> 2.1.0"
    }
  }

  # GCS をバックエンドにする場合はコメントを外す
  # backend "gcs" {
  #   bucket = "your-tfstate-bucket"
  #   prefix = "duckdb-testing"
  # }
}

# Provider configuration is in providers.tf
