variable "kubeconfig_path" {
  type        = string
  description = "Path to kubeconfig"
  default     = "~/.kube/config"
}

variable "namespace" {
  type    = string
  default = "contapro"
}

variable "app_env" {
  type    = string
  default = "staging"
}

variable "cors_origins" {
  type    = string
  default = "https://erp.example.com"
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "redis_url" {
  type      = string
  sensitive = true
}

variable "ledger_hmac_secret" {
  type      = string
  sensitive = true
}

variable "gemini_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "sunat_endpoint" {
  type    = string
  default = ""
}

variable "sunat_ruc" {
  type    = string
  default = ""
}

variable "sunat_sol_user" {
  type      = string
  sensitive = true
  default   = ""
}

variable "sunat_sol_password" {
  type      = string
  sensitive = true
  default   = ""
}
