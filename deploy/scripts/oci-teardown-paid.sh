#!/usr/bin/env bash
# Tear down the paid x86 trial VM (trial_x86_vm = false) so 0 paid resources remain before upgrading to PAYG.
#
# Usage:
#   bash deploy/scripts/oci-teardown-paid.sh [TF_DIR]
set -euo pipefail

TF_DIR="${1:-deploy/terraform/oci}"
echo "=== Terraform dir: $TF_DIR ==="
terraform -chdir="$TF_DIR" plan \
  -var="enable_a1_vm=false" \
  -var="trial_x86_vm=false" \
  -out="teardown-paid.tfplan"

echo ""
echo "Review the plan above carefully. Only trial_x86_vm should be destroyed (VCN + budget stay)."
read -r -p "Type 'YES' to apply teardown-paid.tfplan: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
  echo "Aborted."
  exit 1
fi

terraform -chdir="$TF_DIR" apply "teardown-paid.tfplan"
rm -f "$TF_DIR/teardown-paid.tfplan"
echo "Done! Next: upgrade OCI to PAYG, then run 'bash deploy/scripts/oci-switch-to-a1.sh'."
