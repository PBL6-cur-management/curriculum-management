#!/usr/bin/env bash
# Stores what the deploy job needs in the GitHub environment "demo": VM address, CI SSH key, pinned host key.
# Run locally after `terraform apply`, with `gh auth login` done:  deploy/scripts/set-ci-secrets.sh
# (DEMO_HOST=<ip> to point CD at another VM, e.g. the trial one).
set -euo pipefail

TF_DIR="$(cd "$(dirname "$0")/../terraform/oci" && pwd)"
CI_KEY="${CI_KEY:-$HOME/.ssh/ctdt_ci}"
ENVIRONMENT=demo

# Environments and secrets need admin on the repository; a push-only collaborator gets a bare 404.
if [[ "$(gh api 'repos/{owner}/{repo}' --jq .permissions.admin)" != "true" ]]; then
  echo "Tài khoản gh hiện tại không có quyền admin trên repo: nhờ admin của org chạy script này," >&2
  echo "hoặc cấp quyền admin (Settings → Collaborators and teams)." >&2
  exit 1
fi

# DEMO_HOST overrides the A1 address, e.g. DEMO_HOST="$(terraform output -raw trial_public_ip)" for the trial VM.
HOST="${DEMO_HOST:-$(terraform -chdir="$TF_DIR" output -raw public_ip)}"
[[ -f "$CI_KEY" ]] || { echo "Thiếu khóa CI $CI_KEY (ssh-keygen -t ed25519 -f ~/.ssh/ctdt_ci -N '')" >&2; exit 1; }

# Pin the VM's host key now, from this machine, so the runner never trusts a key on first use.
KNOWN_HOSTS="$(ssh-keyscan -t ed25519 "$HOST" 2>/dev/null)"
[[ -n "$KNOWN_HOSTS" ]] || { echo "ssh-keyscan $HOST không trả về khóa." >&2; exit 1; }

gh api --method PUT "repos/{owner}/{repo}/environments/$ENVIRONMENT" >/dev/null
gh secret set DEMO_SSH_HOST --env "$ENVIRONMENT" --body "$HOST"
gh secret set DEMO_SSH_KNOWN_HOSTS --env "$ENVIRONMENT" --body "$KNOWN_HOSTS"
gh secret set DEMO_SSH_KEY --env "$ENVIRONMENT" < "$CI_KEY"
echo "Đã lưu 3 secret vào environment '$ENVIRONMENT' cho $HOST."
