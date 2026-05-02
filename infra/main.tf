terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
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
