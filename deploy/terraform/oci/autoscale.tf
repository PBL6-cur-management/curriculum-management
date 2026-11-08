# Autoscaling of the web-only API tier (2026-11-06).
#   AWS terms: custom image = AMI, instance configuration = launch template,
#   instance pool = Auto Scaling Group attached to the ALB target group, policy = step scaling on CPU.
# VM2 (oci_core_instance.api2) is the golden image: Docker + compose stack (restart unless-stopped),
# NFS mount of /srv/ctdt/files, Docker ordered after remote-fs. Pool members join the LB backend set on :8080.
# OCI evaluates CPU about every 5 minutes, so this follows sustained load, not a 10-second spike.

variable "autoscale" {
  description = "Create the image, instance pool and autoscaling configuration (needs scale_out)."
  type        = bool
  default     = false
}

variable "pool_min" {
  type    = number
  default = 1
}

variable "pool_max" {
  type    = number
  default = 3
  validation {
    condition     = var.pool_max <= 3
    error_message = "Keep the pool at 3 VMs or less: every VM spends trial credit by the hour."
  }
}

# The autoscale image and instance configuration are created by deploy/scale-out/rebake-image.sh on VM1 after
# every deploy (see rebake.tf), not by Terraform. The pool only needs one to exist when it is first created:
# bootstrap a new environment with deploy/scale-out/rebake-image.sh before enabling autoscale.
data "oci_core_instance_configurations" "api" {
  count          = var.autoscale ? 1 : 0
  compartment_id = local.compartment_id
}

locals {
  api_configs = var.autoscale ? [
    for c in data.oci_core_instance_configurations.api[0].instance_configurations : c
    if startswith(c.display_name, "${var.name}-api-config")
  ] : []
}

resource "oci_core_instance_pool" "api" {
  count                     = var.autoscale ? 1 : 0
  compartment_id            = local.compartment_id
  instance_configuration_id = local.api_configs[0].id # bootstrap only; the rebake script switches it
  display_name              = "${var.name}-api-pool"
  size                      = var.pool_min

  placement_configurations {
    availability_domain = data.oci_identity_availability_domains.all.availability_domains[var.availability_domain_index].name
    primary_subnet_id   = oci_core_subnet.public.id
  }

  load_balancers {
    load_balancer_id = oci_load_balancer_load_balancer.web[0].id
    backend_set_name = oci_load_balancer_backend_set.web[0].name
    port             = 8080
    vnic_selection   = "PrimaryVnic"
  }

  lifecycle {
    ignore_changes = [size, instance_configuration_id] # autoscaler owns size, rebake-image.sh the config
  }
}

resource "oci_autoscaling_auto_scaling_configuration" "api" {
  count                = var.autoscale ? 1 : 0
  compartment_id       = local.compartment_id
  display_name         = "${var.name}-api-autoscale"
  cool_down_in_seconds = 300
  is_enabled           = true

  auto_scaling_resources {
    id   = oci_core_instance_pool.api[0].id
    type = "instancePool"
  }

  policies {
    display_name = "cpu-threshold"
    policy_type  = "threshold"

    capacity {
      initial = var.pool_min
      min     = var.pool_min
      max     = var.pool_max
    }

    rules {
      display_name = "scale-out-cpu-70"
      action {
        type  = "CHANGE_COUNT_BY"
        value = 1
      }
      metric {
        metric_type = "CPU_UTILIZATION"
        threshold {
          operator = "GT"
          value    = 70
        }
      }
    }

    rules {
      display_name = "scale-in-cpu-30"
      action {
        type  = "CHANGE_COUNT_BY"
        value = -1
      }
      metric {
        metric_type = "CPU_UTILIZATION"
        threshold {
          operator = "LT"
          value    = 30
        }
      }
    }
  }
}

output "api_pool_id" {
  value = var.autoscale ? oci_core_instance_pool.api[0].id : null
}
