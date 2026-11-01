#!/usr/bin/env bash
# Retries `terraform apply` while Oracle answers "Out of host capacity" for the Always Free A1 shape
# (common in ap-singapore-1). Any other error stops the loop at once. Run from anywhere:
#   deploy/scripts/apply-until-capacity.sh [minutes-between-tries, default 5] [max-tries, default 60]
set -euo pipefail

TF_DIR="$(cd "$(dirname "$0")/../terraform/oci" && pwd)"
WAIT_MINUTES="${1:-5}"
MAX_TRIES="${2:-60}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

for try in $(seq 1 "$MAX_TRIES"); do
  echo "[$(date '+%F %T')] Lần thử $try/$MAX_TRIES"
  if terraform -chdir="$TF_DIR" apply -auto-approve -input=false -no-color 2>&1 | tee "$LOG"; then
    if ! grep -q "Error:" "$LOG"; then
      echo "Xong: VM đã được tạo."
      terraform -chdir="$TF_DIR" output
      exit 0
    fi
  fi
  if ! grep -qi "out of host capacity\|OutOfCapacity\|InternalError.*capacity" "$LOG"; then
    echo "Lỗi không phải do hết máy: dừng để xem log ở trên." >&2
    exit 1
  fi
  echo "Hết máy A1. Thử lại sau $WAIT_MINUTES phút..."
  sleep "$((WAIT_MINUTES * 60))"
done

echo "Hết $MAX_TRIES lần thử. Giảm ocpus/memory_gb trong terraform.tfvars hoặc thử lại giờ khác." >&2
exit 1
