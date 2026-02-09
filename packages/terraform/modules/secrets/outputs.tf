output "secret_ids" {
  description = "Map of secret name → secret resource ID"
  value = {
    for key, secret in google_secret_manager_secret.secrets :
    key => secret.id
  }
}

output "secret_names" {
  description = "Map of secret name → fully qualified secret name"
  value = {
    for key, secret in google_secret_manager_secret.secrets :
    key => secret.secret_id
  }
}
