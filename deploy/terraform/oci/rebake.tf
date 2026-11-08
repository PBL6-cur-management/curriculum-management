# VM1 re-bakes the autoscale image after every deploy (deploy/scale-out/rebake-image.sh, 2026-11-08).
#
# VM1 calls the OCI API as itself (instance principal), so no OCI key lives on GitHub or on disk.
#   AWS terms: an IAM role attached to the EC2 instance, allowed to create AMIs and launch templates.
# The image and the instance configuration are owned by that script from now on, not by Terraform:
# each deploy creates "<name>-api-image-<sha7>" + "<name>-api-config-<sha7>", points the pool at them and
# deletes the older ones.

locals {
  # VM1 is the x86 trial VM. Referencing oci_core_instance.demo here would make Terraform create the A1 VM.
  vm1_instance_id = oci_core_instance.trial[0].id
}

resource "oci_identity_dynamic_group" "vm1" {
  count          = var.autoscale ? 1 : 0
  compartment_id = var.tenancy_ocid
  name           = "${var.name}-vm1"
  description    = "VM1 of ${var.name}: re-bakes the autoscale image after each deploy"
  matching_rule  = "instance.id = '${local.vm1_instance_id}'"
}

resource "oci_identity_policy" "vm1_rebake" {
  count          = var.autoscale ? 1 : 0
  compartment_id = local.compartment_id
  name           = "${var.name}-vm1-rebake"
  description    = "Let VM1 start/stop the golden VM, create images and instance configurations, update the pool"
  statements = [
    "Allow dynamic-group ${oci_identity_dynamic_group.vm1[0].name} to manage instance-family in compartment id ${local.compartment_id}",
    "Allow dynamic-group ${oci_identity_dynamic_group.vm1[0].name} to manage compute-management-family in compartment id ${local.compartment_id}",
    "Allow dynamic-group ${oci_identity_dynamic_group.vm1[0].name} to use virtual-network-family in compartment id ${local.compartment_id}",
  ]
}
