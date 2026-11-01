# Read-only guard for deploy/scripts/apply-until-capacity.sh: a create call that dies mid-flight (EOF, timeout)
# may still have launched a VM that Terraform never recorded. The script compares this count with the state
# before retrying, so a lost response never turns into a second VM.
data "oci_core_instances" "named_demo" {
  compartment_id = local.compartment_id
  display_name   = var.name

  filter {
    name   = "state"
    values = ["PROVISIONING", "STARTING", "RUNNING", "STOPPING", "STOPPED"]
  }
}

output "demo_instances_in_oci" {
  description = "VMs in OCI named var.name, whether or not Terraform tracks them."
  value       = [for instance in data.oci_core_instances.named_demo.instances : instance.id]
}
