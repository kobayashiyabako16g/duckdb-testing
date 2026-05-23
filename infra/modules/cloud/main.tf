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
  }

  # GCS をバックエンドにする場合はコメントを外す
  # backend "gcs" {
  #   bucket = "your-tfstate-bucket"
  #   prefix = "duckdb-testing"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
