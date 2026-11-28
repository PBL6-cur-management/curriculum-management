#!/usr/bin/env bash
# Deploy from the operator machine without GitHub Actions (single-VM demo setup).
# Same steps as the CD job in .github/workflows/ci-cd.yml: ship the commit and run deploy-release.sh.
#
#   deploy/scripts/deploy-direct.sh [<commit>]      # default HEAD; must be committed, not just in the working tree
#   SSH_KEY=~/.ssh/oci_ctdt DEMO_HOST=<ip> deploy/scripts/deploy-direct.sh
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
SHA="$(git -C "$REPO" rev-parse "${1:-HEAD}^{commit}")"
HOST="${DEMO_HOST:-${VM1_HOST:-129.221.248.234}}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_ctdt}"

echo "==> Ship $SHA to $HOST"
git -C "$REPO" archive --format=tar.gz "$SHA" | ssh -i "$SSH_KEY" -o ServerAliveInterval=30 "ubuntu@$HOST" "
  set -e; d=/srv/ctdt/releases/$SHA
  rm -rf \"\$d.tmp\" && mkdir -p \"\$d.tmp\" && tar -xz -C \"\$d.tmp\"
  chmod +x \"\$d.tmp\"/deploy/scripts/*.sh && rm -rf \"\$d\" && mv \"\$d.tmp\" \"\$d\""

echo "==> Build, migrate, switch on $HOST"
OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT
# Windows OpenSSH can stay open after the remote command ends: return on the done marker instead.
ssh -i "$SSH_KEY" -o ServerAliveInterval=30 "ubuntu@$HOST" "/srv/ctdt/releases/$SHA/deploy/scripts/deploy-release.sh && echo __DEPLOY_OK__" < /dev/null > "$OUT" 2>&1 &
PID=$!
while kill -0 "$PID" 2>/dev/null && ! grep -q '^__DEPLOY_OK__' "$OUT"; do sleep 3; done
kill "$PID" 2>/dev/null || true
grep -E '^==>' "$OUT" || true
grep -q '^__DEPLOY_OK__' "$OUT" || { tail -30 "$OUT" >&2; echo "deploy-release.sh failed on $HOST" >&2; exit 1; }
echo "==> Done: $SHA"
