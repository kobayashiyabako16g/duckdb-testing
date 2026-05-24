# Variables are split by concern into variables/ subdirectory
# Each file manages its own domain:
#   - variables/gcp.tf           : GCP base configuration
#   - variables/common.tf        : Shared settings
#   - variables/cloud_run.tf     : Cloud Run configuration
#   - variables/cloud_sql.tf     : Cloud SQL configuration
#   - variables/cloudflare.tf    : Cloudflare configuration
#   - variables/onepassword.tf   : 1Password configuration
#
# This structure improves maintainability by separating concerns.

