terraform {
  required_version = ">= 1.6"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 6.0, < 8.0"
    }
  }
}

# API-key auth from ~/.oci/config (Console: Profile → API keys → Add API key). No secret lives in this folder.
provider "oci" {
  config_file_profile = var.oci_profile
  region              = var.region
}
