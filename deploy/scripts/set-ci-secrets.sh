#!/usr/bin/env bash
# Stores what the deploy job needs in the GitHub environment "demo": VM address, CI SSH key, pinned host key.
# Run locally after `terraform apply`, with `gh auth login` done:  deploy/scripts/set-ci-secrets.sh
set -euo pipefail

TF_DIR="$(cd "$(dirname "$0")/../terraform/oci" && pwd)"
CI_KEY="${CI_KEY:-$HOME/.ssh/ctdt_ci}"
ENVIRONMENT=demo

HOST="$(terraform -chdir="$TF_DIR" output -raw public_ip)"
[[ -f "$CI_KEY" ]] || { echo "Thiếu khóa CI $CI_KEY (ssh-keygen -t ed25519 -f ~/.ssh/ctdt_ci -N '')" >&2; exit 1; }

# Pin the VM's host key now, from this machine, so the runner never trusts a key on first use.
KNOWN_HOSTS="$(ssh-keyscan -t ed25519 "$HOST" 2>/dev/null)"
[[ -n "$KNOWN_HOSTS" ]] || { echo "ssh-keyscan $HOST không trả về khóa." >&2; exit 1; }

gh api --method PUT "repos/{owner}/{repo}/environments/$ENVIRONMENT" >/dev/null
gh secret set DEMO_SSH_HOST --env "$ENVIRONMENT" --body "$HOST"
gh secret set DEMO_SSH_KNOWN_HOSTS --env "$ENVIRONMENT" --body "$KNOWN_HOSTS"
gh secret set DEMO_SSH_KEY --env "$ENVIRONMENT" < "$CI_KEY"
echo "Đã lưu 3 secret vào environment '$ENVIRONMENT' cho $HOST."
