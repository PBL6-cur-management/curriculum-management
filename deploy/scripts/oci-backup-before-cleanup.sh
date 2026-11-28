#!/usr/bin/env bash
# Backup PostgreSQL (ctdt_real), uploaded attachments (/srv/ctdt/files), and demo.env
# from the current OCI trial VM before tearing down paid resources / upgrading to PAYG.
#
# Usage:
#   bash deploy/scripts/oci-backup-before-cleanup.sh <VM_IP> [LOCAL_BACKUP_DIR] [SSH_KEY_PATH]
set -euo pipefail

VM_IP="${1:?Usage: oci-backup-before-cleanup.sh <VM_IP> [LOCAL_BACKUP_DIR] [SSH_KEY_PATH]}"
OUT_DIR="${2:-D:/oci-demo-backup}"
SSH_KEY="${3:-$HOME/.ssh/oci_ctdt}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT_DIR"

echo "[1/4] Dumping PostgreSQL database (ctdt_real) on $VM_IP..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "ubuntu@${VM_IP}" bash -s "$STAMP" <<'REMOTE'
set -euo pipefail
STAMP="$1"
RELEASE_TAG="$(basename "$(readlink -f /srv/ctdt/current)")"
export RELEASE_TAG
docker compose -p ctdt-production \
  -f /srv/ctdt/current/deploy/compose.yaml \
  --env-file /srv/ctdt/demo.env \
  exec -T postgres pg_dump -U ctdt -d ctdt_real -Fc > "/tmp/ctdt_real_${STAMP}.dump"

echo "[2/4] Archiving /srv/ctdt/files..."
sudo tar -czf "/tmp/files_${STAMP}.tgz" -C /srv/ctdt/files .
sudo cp /srv/ctdt/demo.env "/tmp/demo_${STAMP}.env"
sudo chown ubuntu:ubuntu "/tmp/files_${STAMP}.tgz" "/tmp/demo_${STAMP}.env"
ls -lh "/tmp/ctdt_real_${STAMP}.dump" "/tmp/files_${STAMP}.tgz"
REMOTE

echo "[3/4] Downloading backup artifacts to ${OUT_DIR}..."
scp -i "$SSH_KEY" \
  "ubuntu@${VM_IP}:/tmp/ctdt_real_${STAMP}.dump" \
  "ubuntu@${VM_IP}:/tmp/files_${STAMP}.tgz" \
  "ubuntu@${VM_IP}:/tmp/demo_${STAMP}.env" \
  "$OUT_DIR/"

echo "[4/4] Cleaning temporary files on remote VM..."
ssh -i "$SSH_KEY" "ubuntu@${VM_IP}" "rm -f /tmp/ctdt_real_${STAMP}.dump /tmp/files_${STAMP}.tgz /tmp/demo_${STAMP}.env"

echo "Done! Verify non-empty backups in: $OUT_DIR"
ls -lh "$OUT_DIR"
