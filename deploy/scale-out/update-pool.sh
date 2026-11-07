#!/usr/bin/env bash
# Bring every API VM of the instance pool to the release VM1 is serving, one VM at a time.
#
# CD deploys only VM1. Run this from the operator machine right after each deploy (and after the autoscaler
# adds a VM, whose image may be older). Per VM: drain it on the load balancer, ship the release source,
# rebuild with compose.vm2.yaml, wait for /api/health, put it back. Traffic keeps flowing through the others.
#
#   deploy/scale-out/update-pool.sh            # release = VM1's /srv/ctdt/current
#   OVERLAY="path ..." deploy/scale-out/update-pool.sh
#       also ship these working-tree paths on top of the release (for changes not merged yet)
#
# Needs: oci CLI with ~/.oci/config, ssh key that opens VM1 (pool VMs are reached through VM1).
set -euo pipefail

VM1="${VM1:-ubuntu@129.221.248.234}"
VM1_PRIVATE_IP="${VM1_PRIVATE_IP:-10.0.1.3}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_ctdt}"
BACKEND_SET="${BACKEND_SET:-caddy-8080}"
REPO="$(git rev-parse --show-toplevel)"

ssh_vm1() { ssh -o ConnectTimeout=10 -i "$SSH_KEY" "$VM1" "$@"; }
ssh_pool() {
  local ip="$1"; shift
  ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -i "$SSH_KEY" \
    -o "ProxyCommand=ssh -i $SSH_KEY -W %h:%p $VM1" "ubuntu@$ip" "$@"
}

SHA="$(ssh_vm1 'basename "$(readlink -f /srv/ctdt/current)"')"
TAG="${SHA:0:7}-pool"
echo "VM1 serves $SHA -> pool tag $TAG"
git -C "$REPO" cat-file -e "$SHA^{commit}" || { echo "Commit $SHA is not in this clone: git fetch first." >&2; exit 1; }

TENANCY="$(grep -m1 '^tenancy' ~/.oci/config | cut -d= -f2 | tr -d ' ')"
LB_ID="${LB_ID:-$(oci lb load-balancer list -c "$TENANCY" --all --query 'data[0].id' --raw-output)}"
mapfile -t POOL_IPS < <(oci lb backend list --load-balancer-id "$LB_ID" --backend-set-name "$BACKEND_SET" \
  --query "data[?\"ip-address\"!='$VM1_PRIVATE_IP'].\"ip-address\"" --raw-output | tr -d '[]", ' | grep -v '^$')
[[ ${#POOL_IPS[@]} -gt 0 ]] || { echo "No pool VM behind $BACKEND_SET." >&2; exit 1; }

# Release source: the commit VM1 runs, plus deploy/scale-out and any OVERLAY paths from the working tree.
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
git -C "$REPO" archive "$SHA" source/backend source/frontend | tar -x -C "$WORK"
( cd "$REPO" && tar -c deploy/scale-out ${OVERLAY:-} ) | tar -x -C "$WORK"
tar -C "$WORK" -czf "$WORK.tgz" .

trap_undrain() { [[ -n "${DRAINED:-}" ]] && set_drain "$DRAINED" false; rm -rf "$WORK" "$WORK.tgz"; }
set_drain() {
  oci lb backend update --load-balancer-id "$LB_ID" --backend-set-name "$BACKEND_SET" \
    --backend-name "$1:8080" --weight 1 --backup false --offline false --drain "$2" \
    --wait-for-state SUCCEEDED >/dev/null
}

for ip in "${POOL_IPS[@]}"; do
  current="$(ssh_pool "$ip" 'grep -E "^RELEASE_TAG=" /srv/ctdt/demo.env | tail -1 | cut -d= -f2')"
  if [[ "$current" == "$TAG" ]]; then echo "$ip already on $TAG"; continue; fi
  echo "== $ip: $current -> $TAG"
  set_drain "$ip" true; DRAINED="$ip"; trap trap_undrain EXIT
  # Upload with scp: on Windows OpenSSH, "ssh ... < file" through a ProxyCommand can hang after EOF (2026-11-07).
  scp -q -i "$SSH_KEY" -o "ProxyCommand=ssh -i $SSH_KEY -W %h:%p $VM1" "$WORK.tgz" "ubuntu@$ip:/tmp/$TAG.tgz"
  ssh_pool "$ip" "mkdir -p /srv/ctdt/releases/$TAG && tar -xzf /tmp/$TAG.tgz -C /srv/ctdt/releases/$TAG && rm /tmp/$TAG.tgz" </dev/null
  ssh_pool "$ip" </dev/null "set -e
    sed -i '/^RELEASE_TAG=/d' /srv/ctdt/demo.env && echo RELEASE_TAG=$TAG >> /srv/ctdt/demo.env
    cd /srv/ctdt/releases/$TAG/deploy/scale-out
    sudo docker compose -f compose.vm2.yaml --env-file /srv/ctdt/demo.env up -d --build --wait
    curl -fsS -o /dev/null http://127.0.0.1:8080/api/health
    ls -1dt /srv/ctdt/releases/* | tail -n +3 | xargs -r rm -rf   # keep current + previous"
  set_drain "$ip" false; DRAINED=""
  echo "$ip done"
done
echo "Pool on $TAG."
