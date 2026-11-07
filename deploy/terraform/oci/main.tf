locals {
  compartment_id = var.compartment_ocid != "" ? var.compartment_ocid : var.tenancy_ocid
  ssh_keys       = join("\n", [for path in var.ssh_public_key_paths : trimspace(file(pathexpand(path)))])
  public_ip      = var.use_reserved_ip ? oci_core_public_ip.demo[0].ip_address : oci_core_instance.demo.public_ip
}

data "oci_identity_availability_domains" "all" {
  compartment_id = var.tenancy_ocid
}

# Newest Canonical Ubuntu 24.04 build for the ARM shape.
data "oci_core_images" "ubuntu" {
  compartment_id           = local.compartment_id
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

# ---------- Network: one public subnet, ports 22/80/443 in, everything out ----------

resource "oci_core_vcn" "demo" {
  compartment_id = local.compartment_id
  display_name   = "${var.name}-vcn"
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = "ctdtdemo"
}

resource "oci_core_internet_gateway" "demo" {
  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.demo.id
  display_name   = "${var.name}-igw"
  enabled        = true
}

resource "oci_core_route_table" "public" {
  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.demo.id
  display_name   = "${var.name}-public-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.demo.id
  }
}

resource "oci_core_security_list" "public" {
  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.demo.id
  display_name   = "${var.name}-public-sl"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    description = "SSH (key only) for the operator and CD"
    source      = var.ssh_source_cidr
    protocol    = "6"
    tcp_options {
      min = 22
      max = 22
    }
  }

  # 80 stays open: Let's Encrypt's HTTP challenge, and Caddy redirects it to HTTPS.
  dynamic "ingress_security_rules" {
    for_each = [80, 443]
    content {
      description = "Web (Caddy)"
      source      = "0.0.0.0/0"
      protocol    = "6"
      tcp_options {
        min = ingress_security_rules.value
        max = ingress_security_rules.value
      }
    }
  }

  # Path MTU discovery.
  # scale.tf: the LB and the API pool reach PostgreSQL, Redis, NFS and Caddy :8080 inside the subnet only.
  # Unconditional on purpose: apply-until-capacity.sh targets the demo instance without scale_out, and
  # -target pulls this list in; a conditional rule was removed that way and the LB went 502 (2026-11-06).
  ingress_security_rules {
    description = "VCN-internal traffic (scale-out)"
    source      = "10.0.1.0/24"
    protocol    = "6"
  }

  ingress_security_rules {
    source   = "0.0.0.0/0"
    protocol = "1"
    icmp_options {
      type = 3
      code = 4
    }
  }
}

resource "oci_core_subnet" "public" {
  compartment_id    = local.compartment_id
  vcn_id            = oci_core_vcn.demo.id
  display_name      = "${var.name}-public"
  cidr_block        = "10.0.1.0/24"
  dns_label         = "public"
  route_table_id    = oci_core_route_table.public.id
  security_list_ids = [oci_core_security_list.public.id]
}

# ---------- The VM ----------

resource "oci_core_instance" "demo" {
  compartment_id      = local.compartment_id
  availability_domain = data.oci_identity_availability_domains.all.availability_domains[var.availability_domain_index].name
  display_name        = var.name
  fault_domain        = var.fault_domain != "" ? var.fault_domain : null
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_gb
  }

  # Default: an ephemeral address (always free). With use_reserved_ip the reserved one below is attached instead.
  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = !var.use_reserved_ip
    hostname_label   = "ctdt"
  }

  metadata = {
    ssh_authorized_keys = local.ssh_keys
    user_data           = base64encode(file("${path.module}/cloud-init.yaml"))
  }

  # A newer Ubuntu build or an edited cloud-init must never replace the VM: it holds the demo data.
  lifecycle {
    # fault_domain: once a VM exists, the domain it got must not force a rebuild.
    ignore_changes = [source_details[0].source_id, metadata, fault_domain]
  }
}

# ---------- Optional reserved public IP (use_reserved_ip) ----------

data "oci_core_vnic_attachments" "demo" {
  count          = var.use_reserved_ip ? 1 : 0
  compartment_id = local.compartment_id
  instance_id    = oci_core_instance.demo.id
}

data "oci_core_private_ips" "demo" {
  count   = var.use_reserved_ip ? 1 : 0
  vnic_id = data.oci_core_vnic_attachments.demo[0].vnic_attachments[0].vnic_id
}

# A replaced VM only moves this address to its new private IP; the address itself stays.
# `terraform destroy` releases it, and the DNS record must then be updated by hand.
resource "oci_core_public_ip" "demo" {
  count          = var.use_reserved_ip ? 1 : 0
  compartment_id = local.compartment_id
  display_name   = "${var.name}-ip"
  lifetime       = "RESERVED"
  private_ip_id  = data.oci_core_private_ips.demo[0].private_ips[0].id
}

# ---------- Spending guard ----------

resource "oci_budget_budget" "guard" {
  count          = var.budget_alert_email == "" ? 0 : 1
  compartment_id = var.tenancy_ocid
  display_name   = "${var.name}-guard"
  amount         = 1
  reset_period   = "MONTHLY"
  target_type    = "COMPARTMENT"
  targets        = [var.tenancy_ocid]
}

resource "oci_budget_alert_rule" "any_spend" {
  count          = var.budget_alert_email == "" ? 0 : 1
  budget_id      = oci_budget_budget.guard[0].id
  display_name   = "any-spend"
  type           = "ACTUAL"
  threshold      = 1
  threshold_type = "PERCENTAGE"
  recipients     = var.budget_alert_email
  message        = "Oracle Cloud đã ghi nhận chi phí thật cho tenancy demo CTĐT. Kiểm tra Billing ngay."
}
