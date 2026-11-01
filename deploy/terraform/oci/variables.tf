variable "oci_profile" {
  description = "Profile name in ~/.oci/config."
  type        = string
  default     = "DEFAULT"
}

variable "region" {
  description = "Home region of the tenancy (Always Free compute exists only there), e.g. ap-tokyo-1."
  type        = string
}

variable "tenancy_ocid" {
  description = "Tenancy OCID (the 'tenancy=' line of ~/.oci/config)."
  type        = string
}

variable "compartment_ocid" {
  description = "Compartment for every resource. Empty: the tenancy root compartment."
  type        = string
  default     = ""
}

variable "name" {
  description = "Prefix of every display name."
  type        = string
  default     = "ctdt-demo"
}

variable "availability_domain_index" {
  description = "Which availability domain to try (0-based). Change it when the A1 shape reports 'Out of host capacity'."
  type        = number
  default     = 0
}

variable "fault_domain" {
  description = "FAULT-DOMAIN-1..3 to pin the VM to one fault domain, or empty to let Oracle pick. Free A1 capacity differs per fault domain, so the retry script rotates through them."
  type        = string
  default     = ""

  validation {
    condition     = contains(["", "FAULT-DOMAIN-1", "FAULT-DOMAIN-2", "FAULT-DOMAIN-3"], var.fault_domain)
    error_message = "fault_domain must be empty or FAULT-DOMAIN-1, FAULT-DOMAIN-2, FAULT-DOMAIN-3."
  }
}

# Always Free (2026): Ampere A1 2 OCPU and 12 GB in total per tenancy; 200 GB of boot + block storage in total.
# The defaults take the whole A1 allowance for this one VM; anything above would be billed.
variable "ocpus" {
  description = "Ampere A1 OCPUs."
  type        = number
  default     = 2

  validation {
    condition     = var.ocpus >= 1 && var.ocpus <= 2
    error_message = "Always Free allows at most 2 A1 OCPUs in total."
  }
}

variable "memory_gb" {
  description = "Memory in GB."
  type        = number
  default     = 12

  validation {
    condition     = var.memory_gb >= 6 && var.memory_gb <= 12
    error_message = "Always Free allows at most 12 GB of A1 memory in total; the stack wants at least 6."
  }
}

variable "boot_volume_gb" {
  description = "Boot volume size in GB."
  type        = number
  default     = 100

  validation {
    condition     = var.boot_volume_gb >= 50 && var.boot_volume_gb <= 200
    error_message = "Boot volume must be 50..200 GB to stay within the Always Free 200 GB."
  }
}

variable "ssh_public_key_paths" {
  description = "Public keys allowed to log in as ubuntu: yours and the CI deploy key."
  type        = list(string)
  default     = ["~/.ssh/oci_ctdt.pub", "~/.ssh/ctdt_ci.pub"]
}

variable "ssh_source_cidr" {
  description = "Who may reach port 22. GitHub-hosted runners have no fixed address, so CD needs 0.0.0.0/0; login is key-only."
  type        = string
  default     = "0.0.0.0/0"
}

variable "dns_zone" {
  description = "Domain whose DNS is managed by hand at tenten.vn."
  type        = string
  default     = "oguri-lab.io.vn"
}

variable "public_host" {
  description = "Name the demo is served at; must be inside dns_zone."
  type        = string
  default     = "ctdt.oguri-lab.io.vn"

  validation {
    condition     = endswith(var.public_host, ".oguri-lab.io.vn") || var.public_host == "oguri-lab.io.vn"
    error_message = "public_host must be oguri-lab.io.vn or one of its subdomains."
  }
}

variable "use_reserved_ip" {
  description = "Attach a reserved public IP that survives a rebuilt VM. Off: an ephemeral IP, certainly free; if the VM is ever recreated, update the A record at tenten.vn."
  type        = bool
  default     = false
}

variable "budget_alert_email" {
  description = "Email for the 1 USD budget alert. Empty: no budget is created."
  type        = string
  default     = ""
}
