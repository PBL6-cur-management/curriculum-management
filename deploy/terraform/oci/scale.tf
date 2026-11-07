# Scale-out (performance test 2026-11-06): one more API VM + an OCI Flexible Load Balancer in front.
#   AWS terms: VM2 = a second EC2 in the target group, the LB = an ALB with the TLS certificate on it.
# VM1 (oci_core_instance.trial) keeps PostgreSQL, Redis, the attachment folder and the only queue worker.
# Off by default. Apply only these resources:
#   terraform apply -target=oci_core_instance.api2 -target=oci_load_balancer_load_balancer.web ...
#   (deploy/scripts/scale-out/README.md has the full sequence and the rollback)

variable "scale_out" {
  description = "Create VM2 (web-only API) and the load balancer."
  type        = bool
  default     = false
}

variable "api2_ocpus" {
  type    = number
  default = 1
}

variable "api2_memory_gb" {
  type    = number
  default = 6
}

variable "lb_max_mbps" {
  description = "Flexible LB ceiling. 10 is the Always Free shape and too small for 200 users."
  type        = number
  default     = 100
}

variable "lb_cert_path" {
  description = "PEM certificate chain copied from Caddy on VM1 (kept outside the repo)."
  type        = string
  default     = ""
}

variable "lb_chain_path" {
  description = "PEM intermediate chain (everything after the leaf in Caddy's .crt)."
  type        = string
  default     = ""
}

variable "lb_key_path" {
  description = "PEM private key matching lb_cert_path (kept outside the repo)."
  type        = string
  default     = ""
}

locals {
  vm1_private_ip = var.trial_x86_vm ? oci_core_instance.trial[0].private_ip : null
}

resource "oci_core_instance" "api2" {
  count               = var.scale_out ? 1 : 0
  compartment_id      = local.compartment_id
  availability_domain = data.oci_identity_availability_domains.all.availability_domains[var.availability_domain_index].name
  display_name        = "${var.name}-api2"
  shape               = var.trial_shape
  # Stopped while autoscale is on (no OCPU billing); start it to bake a new image after a release.
  state = var.autoscale ? "STOPPED" : "RUNNING"

  shape_config {
    ocpus         = var.api2_ocpus
    memory_in_gbs = var.api2_memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_x86[0].images[0].id
    boot_volume_size_in_gbs = 50
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = true # SSH for the operator; web traffic only comes through the LB
    hostname_label   = "ctdtapi2"
  }

  metadata = {
    ssh_authorized_keys = local.ssh_keys
    user_data           = base64encode(file("${path.module}/cloud-init.yaml"))
  }

  lifecycle {
    ignore_changes = [source_details[0].source_id, metadata]
  }
}

resource "oci_load_balancer_load_balancer" "web" {
  count          = var.scale_out ? 1 : 0
  compartment_id = local.compartment_id
  display_name   = "${var.name}-lb"
  shape          = "flexible"
  subnet_ids     = [oci_core_subnet.public.id]
  is_private     = false

  shape_details {
    minimum_bandwidth_in_mbps = 10
    maximum_bandwidth_in_mbps = var.lb_max_mbps
  }
}

resource "oci_load_balancer_backend_set" "web" {
  count            = var.scale_out ? 1 : 0
  load_balancer_id = oci_load_balancer_load_balancer.web[0].id
  name             = "caddy-8080"
  policy           = "LEAST_CONNECTIONS"

  health_checker {
    protocol          = "HTTP"
    port              = 8080
    url_path          = "/api/health"
    return_code       = 200
    interval_ms       = 10000
    timeout_in_millis = 5000
    retries           = 3
  }
}

resource "oci_load_balancer_backend" "vm1" {
  count            = var.scale_out ? 1 : 0
  load_balancer_id = oci_load_balancer_load_balancer.web[0].id
  backendset_name  = oci_load_balancer_backend_set.web[0].name
  ip_address       = local.vm1_private_ip
  port             = 8080
}

resource "oci_load_balancer_backend" "vm2" {
  # With autoscale on, the instance pool serves the extra traffic and VM2 is only the golden image source.
  count            = var.scale_out && !var.autoscale ? 1 : 0
  load_balancer_id = oci_load_balancer_load_balancer.web[0].id
  backendset_name  = oci_load_balancer_backend_set.web[0].name
  ip_address       = oci_core_instance.api2[0].private_ip
  port             = 8080
}

resource "oci_load_balancer_certificate" "web" {
  count              = var.scale_out ? 1 : 0
  load_balancer_id   = oci_load_balancer_load_balancer.web[0].id
  certificate_name   = "ctdt-le-${substr(sha1(file(pathexpand(var.lb_cert_path))), 0, 8)}"
  public_certificate = file(pathexpand(var.lb_cert_path))
  private_key        = file(pathexpand(var.lb_key_path))
  ca_certificate     = file(pathexpand(var.lb_chain_path))

  lifecycle {
    create_before_destroy = true
  }
}

resource "oci_load_balancer_listener" "https" {
  count                    = var.scale_out ? 1 : 0
  load_balancer_id         = oci_load_balancer_load_balancer.web[0].id
  name                     = "https"
  default_backend_set_name = oci_load_balancer_backend_set.web_vm1[0].name # pages: VM1 only (routing.tf)
  routing_policy_name      = oci_load_balancer_load_balancer_routing_policy.api_split[0].name
  port                     = 443
  protocol                 = "HTTP"

  ssl_configuration {
    certificate_name        = oci_load_balancer_certificate.web[0].certificate_name
    verify_peer_certificate = false
    protocols               = ["TLSv1.2", "TLSv1.3"]
  }

  connection_configuration {
    idle_timeout_in_seconds = 120
  }
}

resource "oci_load_balancer_rule_set" "to_https" {
  count            = var.scale_out ? 1 : 0
  load_balancer_id = oci_load_balancer_load_balancer.web[0].id
  name             = "to_https"

  items {
    action = "REDIRECT"
    conditions {
      attribute_name  = "PATH"
      attribute_value = "/"
      operator        = "FORCE_LONGEST_PREFIX_MATCH"
    }
    redirect_uri {
      protocol = "HTTPS"
      port     = 443
    }
    response_code = 301
  }
}

resource "oci_load_balancer_listener" "http" {
  count                    = var.scale_out ? 1 : 0
  load_balancer_id         = oci_load_balancer_load_balancer.web[0].id
  name                     = "http"
  default_backend_set_name = oci_load_balancer_backend_set.web[0].name
  port                     = 80
  protocol                 = "HTTP"
  rule_set_names           = [oci_load_balancer_rule_set.to_https[0].name]
}

output "lb_public_ip" {
  value = var.scale_out ? oci_load_balancer_load_balancer.web[0].ip_address_details[0].ip_address : null
}

output "api2_public_ip" {
  value = var.scale_out ? oci_core_instance.api2[0].public_ip : null
}

output "api2_private_ip" {
  value = var.scale_out ? oci_core_instance.api2[0].private_ip : null
}

output "vm1_private_ip" {
  value = local.vm1_private_ip
}
