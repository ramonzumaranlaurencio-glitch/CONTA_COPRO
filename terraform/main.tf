terraform {
  required_version = ">= 1.6.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

resource "kubernetes_namespace" "contapro" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_config_map" "contapro_config" {
  metadata {
    name      = "contapro-config"
    namespace = kubernetes_namespace.contapro.metadata[0].name
  }

  data = {
    APP_ENV                     = var.app_env
    CORS_ORIGINS                = var.cors_origins
    GEMINI_MODEL                = "gemini-1.5-pro"
    OTEL_EXPORTER_OTLP_ENDPOINT = "http://otel-collector:4317"
  }
}

resource "kubernetes_secret" "contapro_secrets" {
  metadata {
    name      = "contapro-secrets"
    namespace = kubernetes_namespace.contapro.metadata[0].name
  }

  data = {
    DATABASE_URL       = var.database_url
    REDIS_URL          = var.redis_url
    LEDGER_HMAC_SECRET = var.ledger_hmac_secret
    GEMINI_API_KEY     = var.gemini_api_key
    SUNAT_ENDPOINT     = var.sunat_endpoint
    SUNAT_RUC          = var.sunat_ruc
    SUNAT_SOL_USER     = var.sunat_sol_user
    SUNAT_SOL_PASSWORD = var.sunat_sol_password
  }
}
