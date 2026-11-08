#!/usr/bin/env bash
# CD: keep every instance-pool VM on the release VM1 serves.
#
# Incident 2026-11-08: CD switched VM1 to a new frontend + API, the pool kept the old API. /api/* is shared by
# both, so the new page sometimes got an old response without the new fields and crashed (".length of undefined").
#
#   ci-pool.sh build  <vm1-host> <sha>   before VM1 switches: ship the release, build images (old containers serve)
#   ci-pool.sh switch <vm1-host> <sha>   after VM1 switched: recreate containers from the prebuilt images (seconds)
#
# A failed build stops CD before VM1 switches, so the two never drift apart. Pool VMs are found by scanning the
# private subnet from VM1 for :8080/api/health, which also covers VMs the autoscaler added.
set -euo pipefail

PHASE="$1"; HOST="$2"; SHA="$3"
TAG="${SHA:0:7}-pool"
VM1_PRIVATE_IP="${VM1_PRIVATE_IP:-10.0.1.3}"
SUBNET="${POOL_SUBNET:-10.0.1}"

# SSH_KEY: operator key for deploy-direct.sh (CI uses ~/.ssh/id_ed25519, the default identity).
KEY_OPT=(); [[ -n "${SSH_KEY:-}" ]] && KEY_OPT=(-i "$SSH_KEY")
POOL_SSH=("${KEY_OPT[@]}" -o ServerAliveInterval=30 -o ConnectTimeout=15
  -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$HOME/.ssh/pool_known_hosts"
  -o "ProxyCommand=ssh ${SSH_KEY:+-i $SSH_KEY} -o ServerAliveInterval=30 -W %h:%p ubuntu@$HOST")

# Command substitution (not < <(...)) so an ssh failure stops CD instead of looking like "no pool VM".
found="$(ssh "${KEY_OPT[@]}" "ubuntu@$HOST" "for i in \$(seq 2 254); do ip=$SUBNET.\$i; [ \$ip = $VM1_PRIVATE_IP ] && continue
  (curl -fs -m 2 -o /dev/null http://\$ip:8080/api/health && echo \$ip) & done; wait")"
mapfile -t IPS < <(printf '%s\n' "$found" | grep -v '^$' | sort)
if [[ ${#IPS[@]} -eq 0 ]]; then echo "No pool VM answers on :8080, nothing to do."; exit 0; fi
echo "Pool VMs: ${IPS[*]} -> $TAG ($PHASE)"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

# Run a command on a pool VM and return as soon as it prints the done marker. Windows OpenSSH (deploy-direct.sh)
# can stay open after the remote command ended when going through a ProxyCommand; CI on Linux exits normally.
run_pool() {
  local ip="$1" cmd="$2" out pid
  out="$WORK/out-$ip-$RANDOM"
  ssh "${POOL_SSH[@]}" "ubuntu@$ip" "$cmd
    echo __CI_POOL_DONE__" </dev/null > "$out" 2>&1 &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    grep -q '^__CI_POOL_DONE__' "$out" && { sleep 1; kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; break; }
    sleep 2
  done
  wait "$pid" 2>/dev/null || true
  grep -v '^__CI_POOL_DONE__' "$out" | tail -5
  grep -q '^__CI_POOL_DONE__' "$out"
}

for ip in "${IPS[@]}"; do
  case "$PHASE" in
    build)
      # Upload with scp, then ssh without stdin: Windows OpenSSH hangs after EOF when "ssh ... < pipe" goes
      # through a ProxyCommand (deploy-direct.sh runs this script on the operator's Windows machine).
      git archive --format=tar.gz -o "$WORK/release.tgz" "$SHA"
      scp -q "${POOL_SSH[@]}" "$WORK/release.tgz" "ubuntu@$ip:/tmp/$TAG.tgz"
      run_pool "$ip" "set -e
        d=/srv/ctdt/releases/$TAG; rm -rf \$d && mkdir -p \$d && tar -xzf /tmp/$TAG.tgz -C \$d && rm /tmp/$TAG.tgz
        cd \$d/deploy/scale-out
        sudo RELEASE_TAG=$TAG docker compose -f compose.vm2.yaml --env-file /srv/ctdt/demo.env build -q"
      echo "$ip built";;
    switch)
      run_pool "$ip" "set -e
        sed -i '/^RELEASE_TAG=/d' /srv/ctdt/demo.env && echo RELEASE_TAG=$TAG >> /srv/ctdt/demo.env
        cd /srv/ctdt/releases/$TAG/deploy/scale-out
        sudo docker compose -f compose.vm2.yaml --env-file /srv/ctdt/demo.env up -d --no-build --wait
        curl -fsS -o /dev/null http://127.0.0.1:8080/api/health
        ls -1dt /srv/ctdt/releases/* | tail -n +3 | xargs -r sudo rm -rf
        sudo docker image prune -f >/dev/null"
      echo "$ip on $TAG";;
    *) echo "unknown phase $PHASE" >&2; exit 2;;
  esac
done
