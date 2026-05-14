output "namespace" {
  value = kubernetes_namespace.contapro.metadata[0].name
}

output "config_map" {
  value = kubernetes_config_map.contapro_config.metadata[0].name
}

output "secret_name" {
  value     = kubernetes_secret.contapro_secrets.metadata[0].name
  sensitive = true
}
