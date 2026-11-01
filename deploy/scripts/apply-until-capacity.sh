#!/usr/bin/env bash
# Keeps asking Oracle for an Always Free A1 VM while it answers "Out of host capacity" (common in
# ap-singapore-1). Each round tries every fault domain, the full shape first and then the small one, because
# freed capacity appears for a few minutes in one fault domain at a time. Any other error stops at once.
#   deploy/scripts/apply-until-capacity.sh [seconds-between-rounds, default 15] [max-hours, default 12]
#   SHAPES="2:12 1:6" FAULT_DOMAINS="FAULT-DOMAIN-1 FAULT-DOMAIN-2 FAULT-DOMAIN-3" to change the order.
# A VM created with 1 OCPU / 6 GB can be grown later: set ocpus/memory_gb in terraform.tfvars and apply
# (Oracle restarts the VM; the grow itself also needs free capacity).
set -euo pipefail

TF_DIR="$(cd "$(dirname "$0")/../terraform/oci" && pwd)"
INTERVAL="${1:-15}"
MAX_HOURS="${2:-12}"
SHAPES="${SHAPES:-2:12 1:6}"
FAULT_DOMAINS="${FAULT_DOMAINS:-FAULT-DOMAIN-1 FAULT-DOMAIN-2 FAULT-DOMAIN-3}"
DEADLINE=$(($(date +%s) + MAX_HOURS * 3600))
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

round=0
while (($(date +%s) < DEADLINE)); do
  round=$((round + 1))
  for shape in $SHAPES; do
    ocpus="${shape%%:*}"
    memory="${shape##*:}"
    for fd in $FAULT_DOMAINS; do
      if terraform -chdir="$TF_DIR" apply -auto-approve -input=false -no-color \
        -var "ocpus=$ocpus" -var "memory_gb=$memory" -var "fault_domain=$fd" >"$LOG" 2>&1; then
        echo "[$(date '+%F %T')] Vòng $round: CÓ MÁY — $ocpus OCPU / $memory GB ở $fd."
        echo "Ghi ocpus = $ocpus, memory_gb = $memory, fault_domain = \"$fd\" vào terraform.tfvars để các lần apply sau khớp."
        terraform -chdir="$TF_DIR" output
        exit 0
      fi
      if ! grep -qi "out of host capacity" "$LOG"; then
        echo "[$(date '+%F %T')] Lỗi không phải do hết máy ($ocpus/$memory, $fd):" >&2
        grep -E "Error" -A5 "$LOG" >&2 || tail -20 "$LOG" >&2
        exit 1
      fi
    done
  done
  echo "[$(date '+%F %T')] Vòng $round: hết máy ở mọi fault domain và cấu hình. Thử lại sau ${INTERVAL}s."
  sleep "$INTERVAL"
done

echo "Hết $MAX_HOURS giờ chưa có máy. Thử giờ khác (đêm/sáng sớm), hoặc nâng Pay As You Go." >&2
exit 1
