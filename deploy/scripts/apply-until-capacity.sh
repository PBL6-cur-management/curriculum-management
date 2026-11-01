#!/usr/bin/env bash
# Hunts an Always Free A1 VM while Oracle answers "Out of host capacity" (common in ap-singapore-1).
#   deploy/scripts/apply-until-capacity.sh [max-hours, default 0 = until it succeeds]
# One launch call per cycle, alternating SHAPES, every INTERVAL s + 0..JITTER s; Oracle picks the fault domain.
# Network blips and 429 back off BACKOFF_MIN..BACKOFF_MAX s and keep going; anything else (auth, quota,
# validation) stops. Community reports: calling faster than ~2 min mostly buys rate limits, not VMs.
# A VM created with 1 OCPU / 6 GB can be grown later in terraform.tfvars (the grow also needs capacity).
set -euo pipefail

TF_DIR="$(cd "$(dirname "$0")/../terraform/oci" && pwd)"
MAX_HOURS="${1:-0}"
SHAPES="${SHAPES:-2:12 1:6}"
INTERVAL="${INTERVAL:-120}"
JITTER="${JITTER:-30}"
BACKOFF_MIN="${BACKOFF_MIN:-300}"
BACKOFF_MAX="${BACKOFF_MAX:-600}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

now() { date '+%F %T'; }
rand_between() { echo $(($1 + RANDOM % ($2 - $1 + 1))); }

# capacity | transient | fatal, from a failed apply's output.
classify() {
  if grep -qi "out of host capacity" "$1"; then
    echo capacity
  elif grep -qiE "\bEOF\b|TooManyRequests|429|timeout|timed out|connection reset|connection refused|TLS handshake|no such host|50[234]-|Error acquiring the state lock|InternalServerError" "$1"; then
    echo transient
  else
    echo fatal
  fi
}

# Stops the hunt if OCI has a VM named like ours that the state does not track (a lost create response).
guard_untracked_vm() {
  terraform -chdir="$TF_DIR" apply -refresh-only -auto-approve -input=false -no-color >/dev/null 2>&1 || return 0
  local ids
  ids="$(terraform -chdir="$TF_DIR" output -json demo_instances_in_oci 2>/dev/null | tr -d '[]" \n')"
  if [[ -n "$ids" ]] && ! terraform -chdir="$TF_DIR" state list 2>/dev/null | grep -qx 'oci_core_instance.demo'; then
    echo "[$(now)] OCI có VM mà Terraform không theo dõi: $ids" >&2
    echo "Nhập vào state rồi chạy lại: terraform -chdir=$TF_DIR import oci_core_instance.demo <ocid>" >&2
    exit 1
  fi
}

[[ "$MAX_HOURS" =~ ^[0-9]+$ ]] || { echo "max-hours phải là số nguyên (0 = không giới hạn)" >&2; exit 2; }
if [[ "${CLASSIFY_ONLY:-}" != "" ]]; then classify "$CLASSIFY_ONLY"; exit 0; fi # offline check of classify()

read -r -a shapes <<<"$SHAPES"
deadline=$((MAX_HOURS > 0 ? $(date +%s) + MAX_HOURS * 3600 : 0))
attempt=0
transient=0

while ((deadline == 0 || $(date +%s) < deadline)); do
  shape="${shapes[$((attempt % ${#shapes[@]}))]}"
  ocpus="${shape%%:*}"
  memory="${shape##*:}"
  attempt=$((attempt + 1))

  if terraform -chdir="$TF_DIR" apply -auto-approve -input=false -no-color -refresh=false \
    -target=oci_core_instance.demo -var "ocpus=$ocpus" -var "memory_gb=$memory" -var 'fault_domain=' >"$LOG" 2>&1; then
    echo "[$(now)] Lần $attempt: CÓ MÁY — $ocpus OCPU / $memory GB."
    terraform -chdir="$TF_DIR" apply -auto-approve -input=false -no-color \
      -var "ocpus=$ocpus" -var "memory_gb=$memory" >/dev/null
    echo "Ghi ocpus = $ocpus, memory_gb = $memory vào terraform.tfvars để các lần apply sau khớp."
    terraform -chdir="$TF_DIR" output
    exit 0
  fi

  case "$(classify "$LOG")" in
    capacity)
      transient=0
      wait=$((INTERVAL + $(rand_between 0 "$JITTER")))
      echo "[$(now)] Lần $attempt ($ocpus/$memory): hết máy. Thử lại sau ${wait}s."
      ;;
    transient)
      transient=$((transient + 1))
      wait=$(rand_between "$BACKOFF_MIN" "$BACKOFF_MAX")
      echo "[$(now)] Lần $attempt ($ocpus/$memory): lỗi tạm #$transient — $(grep -m1 -E 'Error' "$LOG" | cut -c1-160). Chờ ${wait}s."
      guard_untracked_vm
      ;;
    fatal)
      echo "[$(now)] Lần $attempt ($ocpus/$memory): lỗi không thử lại được:" >&2
      grep -E "Error" -A5 "$LOG" >&2 || tail -20 "$LOG" >&2
      exit 1
      ;;
  esac
  sleep "$wait"
done

echo "Hết $MAX_HOURS giờ chưa có máy. Chạy lại, hoặc nâng Pay As You Go." >&2
exit 1
