# Cloud Scheduler からの呼び出しに使用するサービスアカウント
resource "google_service_account" "cloud_scheduler" {
  account_id   = "duckdb-testing-scheduler"
  display_name = "duckdb-testing Cloud Scheduler Service Account"
}

# Cloud SQL インスタンスの停止・起動権限
resource "google_project_iam_member" "scheduler_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_scheduler.email}"
}

resource "google_project_iam_member" "scheduler_cloudsql_editor" {
  project = var.project_id
  role    = "roles/cloudsql.editor"
  member  = "serviceAccount:${google_service_account.cloud_scheduler.email}"
}

# Cloud Workflows 実行権限
resource "google_project_iam_member" "scheduler_workflows_invoker" {
  project = var.project_id
  role    = "roles/workflows.invoker"
  member  = "serviceAccount:${google_service_account.cloud_scheduler.email}"
}

# Cloud Scheduler：Cloud SQL インスタンスの起動（毎日朝 7時 JST / UTC 22時）
resource "google_cloud_scheduler_job" "cloudsql_startup" {
  name             = "duckdb-testing-db-startup"
  description      = "Cloud SQL インスタンスの起動（毎日朝 7時 JST）"
  schedule         = "0 22 * * *"  # 毎日、22:00 UTC (7:00 JST)
  time_zone        = "Etc/UTC"
  attempt_deadline = "320s"
  region           = var.region
  paused           = !var.enable_auto_start_stop

  http_target {
    uri        = "https://workflowexecutions.googleapis.com/v1/projects/${var.project_id}/locations/${var.region}/workflows/${google_cloud_workflows_workflow.cloudsql_startup.name}/executions"
    http_method = "POST"
    headers = {
      "Content-Type" = "application/json"
    }
    body = base64encode(jsonencode({
      argument = jsonencode({})
    }))
    oidc_token {
      service_account_email = google_service_account.cloud_scheduler.email
    }
  }

  depends_on = [
    google_cloud_workflows_workflow.cloudsql_startup,
    google_project_iam_member.scheduler_workflows_invoker,
  ]
}

# Cloud Scheduler：Cloud SQL インスタンスの停止（毎日夜 22時 JST / UTC 13時）
resource "google_cloud_scheduler_job" "cloudsql_shutdown" {
  name             = "duckdb-testing-db-shutdown"
  description      = "Cloud SQL インスタンスの停止（毎日夜 22時 JST）"
  schedule         = "0 13 * * *"  # 毎日、13:00 UTC (22:00 JST)
  time_zone        = "Etc/UTC"
  attempt_deadline = "320s"
  region           = var.region
  paused           = !var.enable_auto_start_stop

  http_target {
    uri        = "https://workflowexecutions.googleapis.com/v1/projects/${var.project_id}/locations/${var.region}/workflows/${google_cloud_workflows_workflow.cloudsql_shutdown.name}/executions"
    http_method = "POST"
    headers = {
      "Content-Type" = "application/json"
    }
    body = base64encode(jsonencode({
      argument = jsonencode({})
    }))
    oidc_token {
      service_account_email = google_service_account.cloud_scheduler.email
    }
  }

  depends_on = [
    google_cloud_workflows_workflow.cloudsql_shutdown,
    google_project_iam_member.scheduler_workflows_invoker,
  ]
}

# Cloud Workflows：Cloud SQL インスタンス起動
resource "google_cloud_workflows_workflow" "cloudsql_startup" {
  name            = "duckdb-testing-startup"
  region          = var.region
  service_account = google_service_account.cloud_scheduler.email
  source_contents = <<-EOT
    steps:
      - startup:
          call: googleapis.sql.v1.instances.patch
          args:
            project: "${var.project_id}"
            instance: "${google_sql_database_instance.postgres.name}"
            body:
              settings:
                activationPolicy: "ALWAYS"
          result: startup_result
      - return_success:
          return: $${startup_result}
  EOT

  depends_on = [google_sql_database_instance.postgres]
}

# Cloud Workflows：Cloud SQL インスタンス停止
resource "google_cloud_workflows_workflow" "cloudsql_shutdown" {
  name            = "duckdb-testing-shutdown"
  region          = var.region
  service_account = google_service_account.cloud_scheduler.email
  source_contents = <<-EOT
    steps:
      - shutdown:
          call: googleapis.sql.v1.instances.patch
          args:
            project: "${var.project_id}"
            instance: "${google_sql_database_instance.postgres.name}"
            body:
              settings:
                activationPolicy: "NEVER"
          result: shutdown_result
      - return_success:
          return: $${shutdown_result}
  EOT

  depends_on = [google_sql_database_instance.postgres]
}
