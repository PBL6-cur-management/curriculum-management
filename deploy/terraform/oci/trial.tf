# Optional stop-gap while the Always Free A1 VM is out of capacity: an x86 VM paid from the Free Trial's
# 300 USD credit (not from the card: a trial that was never upgraded cannot spend beyond its credit).
# 1 OCPU / 6 GB ≈ 0.045 USD/hour ≈ 1.1 USD/day on E4 (E5 ≈ 0.055, E3 ≈ 0.04; Oracle list price, 2026-11).
# The trial ends 30 days after sign-up (sign-up 2026-11-01): move the demo to the A1 VM and set
# trial_x86_vm = false before then, or the VM is stopped when the credit or the 30 days run out.

variable "trial_x86_vm" {
  description = "Create the credit-paid x86 stop-gap VM."
  type        = bool
  default     = false
}

variable "trial_shape" {
  description = "x86 flex shape of the stop-gap VM; switch when one is out of capacity."
  type        = string
  default     = "VM.Standard.E4.Flex"

  validation {
    condition     = contains(["VM.Standard.E3.Flex", "VM.Standard.E4.Flex", "VM.Standard.E5.Flex"], var.trial_shape)
    error_message = "trial_shape must be VM.Standard.E3.Flex, E4.Flex or E5.Flex."
  }
}

variable "trial_fault_domain" {
  description = "FAULT-DOMAIN-1..3, or empty to let Oracle pick."
  type        = string
  default     = ""
}

variable "trial_ocpus" {
  description = "OCPUs of the stop-gap VM (1 OCPU = 2 vCPU on x86)."
  type        = number
  default     = 1

  validation {
    condition     = var.trial_ocpus >= 1 && var.trial_ocpus <= 2
    error_message = "Keep the stop-gap VM at 1-2 OCPUs: it spends trial credit by the hour."
  }
}

variable "trial_memory_gb" {
  description = "Memory of the stop-gap VM in GB."
  type        = number
  default     = 6

  validation {
    condition     = var.trial_memory_gb >= 6 && var.trial_memory_gb <= 12
    error_message = "Keep the stop-gap VM at 6-12 GB."
  }
}

# 50 GB keeps both VMs (100 + 50) inside the 200 GB of always-free block storage.
variable "trial_boot_volume_gb" {
  description = "Boot volume of the stop-gap VM in GB."
  type        = number
  default     = 50
}

data "oci_core_images" "ubuntu_x86" {
  count                    = var.trial_x86_vm ? 1 : 0
  compartment_id           = local.compartment_id
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = var.trial_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_instance" "trial" {
  count               = var.trial_x86_vm ? 1 : 0
  compartment_id      = local.compartment_id
  availability_domain = data.oci_identity_availability_domains.all.availability_domains[var.availability_domain_index].name
  display_name        = "${var.name}-trial-x86"
  fault_domain        = var.trial_fault_domain != "" ? var.trial_fault_domain : null
  shape               = var.trial_shape

  shape_config {
    ocpus         = var.trial_ocpus
    memory_in_gbs = var.trial_memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_x86[0].images[0].id
    boot_volume_size_in_gbs = var.trial_boot_volume_gb
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = true
    hostname_label   = "ctdttrial"
  }

  # Same first boot as the A1 VM: Docker, iptables 80/443, /srv/ctdt, no SSH passwords.
  metadata = {
    ssh_authorized_keys = local.ssh_keys
    user_data           = base64encode(file("${path.module}/cloud-init.yaml"))
  }

  lifecycle {
    ignore_changes = [source_details[0].source_id, metadata, fault_domain]
  }
}

output "trial_public_ip" {
  value = var.trial_x86_vm ? oci_core_instance.trial[0].public_ip : null
}

output "trial_ssh" {
  value = var.trial_x86_vm ? "ssh -i ~/.ssh/oci_ctdt ubuntu@${oci_core_instance.trial[0].public_ip}" : null
}
