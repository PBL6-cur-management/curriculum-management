#!/usr/bin/env bash
# Deploy from the operator machine without GitHub Actions (use when GitHub is down, 2026-11-08).
# Same steps as the CD job in .github/workflows/ci-cd.yml: ship the commit to VM1, prebuild on pool VMs,
# deploy-release.sh on VM1 (also publishes the release and re-bakes the autoscale image), switch pool VMs.
#
#   deploy/scripts/deploy-direct.sh [<commit>]      # default HEAD; must be committed, not just in the working tree
#   SSH_KEY=~/.ssh/oci_ctdt VM1_HOST=129.221.248.234 deploy/scripts/deploy-direct.sh
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
SHA="$(git -C "$REPO" rev-parse "${1:-HEAD}^{commit}")"
HOST="${VM1_HOST:-129.221.248.234}"
export SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_ctdt}"

# ci-pool.sh calls plain "ssh"; give it the operator key through a wrapper on PATH.
BIN="$(mktemp -d)"; trap 'rm -rf "$BIN"' EXIT
printf '#!/bin/sh\nexec %s -i "%s" "$@"\n' "$(command -v ssh)" "$SSH_KEY" > "$BIN/ssh"; chmod +x "$BIN/ssh"
export PATH="$BIN:$PATH"

echo "==> Ship $SHA to $HOST"
git -C "$REPO" archive --format=tar.gz "$SHA" | ssh -o ServerAliveInterval=30 "ubuntu@$HOST" "
  set -e; d=/srv/ctdt/releases/$SHA
  rm -rf \"\$d.tmp\" && mkdir -p \"\$d.tmp\" && tar -xz -C \"\$d.tmp\"
  chmod +x \"\$d.tmp\"/deploy/scripts/*.sh && rm -rf \"\$d\" && mv \"\$d.tmp\" \"\$d\""

cd "$REPO"
echo "==> Prebuild on pool VMs"
git -C "$REPO" show "$SHA:deploy/scale-out/ci-pool.sh" > "$BIN/ci-pool.sh"
bash "$BIN/ci-pool.sh" build "$HOST" "$SHA"
echo "==> Build, migrate, switch VM1"
# Windows OpenSSH can stay open after the remote command ends: return on the done marker instead.
OUT="$BIN/vm1.log"
ssh -o ServerAliveInterval=30 "ubuntu@$HOST" "/srv/ctdt/releases/$SHA/deploy/scripts/deploy-release.sh && echo __DEPLOY_OK__"   < /dev/null > "$OUT" 2>&1 &
PID=$!
while kill -0 "$PID" 2>/dev/null && ! grep -q '^__DEPLOY_OK__' "$OUT"; do sleep 3; done
kill "$PID" 2>/dev/null || true
grep -E '^==>' "$OUT" || true
grep -q '^__DEPLOY_OK__' "$OUT" || { tail -30 "$OUT" >&2; echo "deploy-release.sh failed on VM1" >&2; exit 1; }
echo "==> Switch pool VMs"
bash "$BIN/ci-pool.sh" switch "$HOST" "$SHA"
echo "==> Done: $SHA"
