resource "google_artifact_registry_repository" "api" {
  repository_id = "duckdb-testing"
  format        = "DOCKER"
  location      = var.region
  description   = "duckdb-testing API Docker images"
}
