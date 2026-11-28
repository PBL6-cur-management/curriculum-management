#!/usr/bin/env bash
# 1-click switch AFTER upgrading OCI to Pay As You Go (PAYG):
#   1. Provision 1 Always Free A1 VM (2 OCPU / 12 GB, 100 GB boot volume — $0/month forever)
#   2. Wait for cloud-init (Docker + firewall + /srv/ctdt)
#   3. Upload backed-up demo.env, PostgreSQL dump, and uploaded files from LOCAL_BACKUP_DIR
#   4. Ship latest commit, restore DB + files, start stack
#   5. Destroy the old paid trial x86 VM (ctdt-demo-trial-x86) so monthly bill = $0.00!
#
# Usage (from Git Bash):
#   bash deploy/scripts/oci-switch-to-a1.sh [TF_DIR] [LOCAL_BACKUP_DIR] [SSH_KEY]
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
TF_DIR="${1:-$REPO/../cm-demo/deploy/terraform/oci}"
BACKUP_DIR="${2:-D:/oci-demo-backup}"
SSH_KEY="${3:-$HOME/.ssh/oci_ctdt}"
SHA="$(git -C "$REPO" rev-parse HEAD)"

DUMP="$(ls -1t "$BACKUP_DIR"/ctdt_real_*.dump 2>/dev/null | head -n 1 || true)"
FILES="$(ls -1t "$BACKUP_DIR"/files_*.tgz 2>/dev/null | head -n 1 || true)"
ENV_FILE="$(ls -1t "$BACKUP_DIR"/demo_*.env 2>/dev/null | head -n 1 || true)"

[[ -f "$DUMP" ]] || { echo "Thiếu file dump trong $BACKUP_DIR" >&2; exit 1; }
[[ -f "$FILES" ]] || { echo "Thiếu file files_*.tgz trong $BACKUP_DIR" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Thiếu file demo_*.env trong $BACKUP_DIR" >&2; exit 1; }
[[ -f "$SSH_KEY" ]] || { echo "Thiếu SSH key $SSH_KEY" >&2; exit 1; }

echo "=== [1/5] Provisioning 1 Always Free A1 VM (2 OCPU / 12 GB) & destroying paid trial_x86_vm ==="
cat > "$TF_DIR/terraform.tfvars" <<'TFVARS'
region             = "ap-singapore-1"
tenancy_ocid       = "ocid1.tenancy.oc1..aaaaaaaas2hozkuahplp7b63t5kl37yya7av3y73ygmxzkqq3ssz3xesupyq"
budget_alert_email = "nguyenthanhhieu17022005@gmail.com"

# 1 single Always Free Ampere A1 VM ($0/month on PAYG)
enable_a1_vm    = true
ocpus           = 2
memory_gb       = 12
boot_volume_gb  = 100
use_reserved_ip = false

# Paid x86 stop-gap OFF
trial_x86_vm = false
TFVARS

# Create the A1 VM first BEFORE destroying trial_x86_vm (or apply both atomically if trial already backed up)
terraform -chdir="$TF_DIR" apply -auto-approve

NEW_IP="$(terraform -chdir="$TF_DIR" output -raw public_ip)"
echo "==> New Always Free A1 VM IP: $NEW_IP"

echo "=== [2/5] Waiting for SSH & cloud-init on $NEW_IP ==="
for _ in $(seq 1 60); do
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "ubuntu@$NEW_IP" "test -f /srv/ctdt/.cloud-init-done" 2>/dev/null; then
    break
  fi
  sleep 5
done
ssh -i "$SSH_KEY" "ubuntu@$NEW_IP" "test -f /srv/ctdt/.cloud-init-done" || { echo "cloud-init chưa xong trên $NEW_IP" >&2; exit 1; }

echo "=== [3/5] Uploading demo.env, DB dump & files to $NEW_IP ==="
scp -i "$SSH_KEY" "$ENV_FILE" "ubuntu@$NEW_IP:/srv/ctdt/demo.env"
ssh -i "$SSH_KEY" "ubuntu@$NEW_IP" "chmod 600 /srv/ctdt/demo.env"
scp -i "$SSH_KEY" "$DUMP" "ubuntu@$NEW_IP:/srv/ctdt/incoming/ctdt_real.dump"
scp -i "$SSH_KEY" "$FILES" "ubuntu@$NEW_IP:/srv/ctdt/incoming/files.tgz"

echo "=== [4/5] Shipping release $SHA to $NEW_IP ==="
git -C "$REPO" archive --format=tar.gz "$SHA" | ssh -i "$SSH_KEY" -o ServerAliveInterval=30 "ubuntu@$NEW_IP" "
  set -e; d=/srv/ctdt/releases/$SHA
  rm -rf \"\$d.tmp\" && mkdir -p \"\$d.tmp\" && tar -xz -C \"\$d.tmp\"
  chmod +x \"\$d.tmp\"/deploy/scripts/*.sh && rm -rf \"\$d\" && mv \"\$d.tmp\" \"\$d\""

echo "=== [5/5] Restoring DB + files and starting single-VM stack ==="
echo "NOTE: Update DNS A record for ctdt.oguri-lab.io.vn -> $NEW_IP at tenten.vn BEFORE Caddy requests TLS!"
echo "Then run:"
echo "  ssh -i $SSH_KEY ubuntu@$NEW_IP \"/srv/ctdt/releases/$SHA/deploy/scripts/restore-demo-data.sh /srv/ctdt/incoming/ctdt_real.dump /srv/ctdt/incoming/files.tgz\""
echo "  DEMO_HOST=$NEW_IP bash deploy/scripts/set-ci-secrets.sh"
