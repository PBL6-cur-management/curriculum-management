#!/usr/bin/env bash
# Pool VM boot sync: never serve the load balancer with a release other than the one VM1 runs (2026-11-08).
#
# Autoscale boots new VMs from a baked image that is older than VM1 as soon as the next deploy lands. An old API
# behind the shared /api/* backend set crashes newer pages (incident 2026-11-08, releasedVersions undefined).
#
#   pool-sync.sh gate   close :8080 to the subnet (the LB health check fails, the LB sends nothing)
#   pool-sync.sh        gate, then bring this VM to VM1's release (NFS export /srv/ctdt/release-export,
#                       written by deploy-release.sh), wait for health, open the gate. Retries for 10 minutes;
#                       on failure the gate stays closed, so a stale VM never takes traffic.
#
# Baked into the autoscale image as /usr/local/sbin/ctdt-pool-sync with ctdt-pool-gate.service (before docker)
# and ctdt-pool-sync.service (after docker and the network), both every boot. After each sync it re-installs
# itself and the units from the release, so the image rebaked after a deploy carries the newest version.
set -uo pipefail

VM1_PRIVATE_IP="${VM1_PRIVATE_IP:-10.0.1.3}"
SUBNET="${POOL_SUBNET_CIDR:-10.0.1.0/24}"
MNT=/mnt/ctdt-release
ENV_FILE=/srv/ctdt/demo.env
RULE=(PREROUTING -s "$SUBNET" -p tcp --dport 8080 -j DROP)

gate_on() { iptables -t raw -C "${RULE[@]}" 2>/dev/null || iptables -t raw -I "${RULE[@]}"; }
gate_off() { while iptables -t raw -D "${RULE[@]}" 2>/dev/null; do :; done; }
healthy() { curl -fsS -m 5 -o /dev/null http://127.0.0.1:8080/api/health; }
log() { echo "ctdt-pool-sync: $*"; logger -t ctdt-pool-sync "$*" 2>/dev/null || true; }

if [[ "${1:-}" == gate ]]; then gate_on; exit 0; fi

gate_on
for attempt in $(seq 1 60); do
  mkdir -p "$MNT"
  if ! mountpoint -q "$MNT" && ! mount -t nfs4 -o ro,soft,timeo=50 "$VM1_PRIVATE_IP:/srv/ctdt/release-export" "$MNT"; then
    log "attempt $attempt: NFS not ready"; sleep 10; continue
  fi
  sha="$(cat "$MNT/current.sha" 2>/dev/null)"
  if [[ ! "$sha" =~ ^[0-9a-f]{40}$ || ! -f "$MNT/release-$sha.tgz" ]]; then
    log "attempt $attempt: no release published"; sleep 10; continue
  fi
  tag="${sha:0:7}-pool"
  current="$(grep -E '^RELEASE_TAG=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
  dir="/srv/ctdt/releases/$tag"
  if [[ "$current" != "$tag" || ! -d "$dir" ]] || ! healthy; then
    log "attempt $attempt: ${current:-none} -> $tag"
    rm -rf "$dir.tmp" && mkdir -p "$dir.tmp" && tar -xzf "$MNT/release-$sha.tgz" -C "$dir.tmp" \
      && rm -rf "$dir" && mv "$dir.tmp" "$dir" || { log "extract failed"; sleep 10; continue; }
    sed -i '/^RELEASE_TAG=/d' "$ENV_FILE" && echo "RELEASE_TAG=$tag" >> "$ENV_FILE"
    mkdir -p -m 0777 /srv/ctdt/files 2>/dev/null || true
    chmod 755 /srv /srv/ctdt 2>/dev/null || true
    chmod 777 /srv/ctdt/files 2>/dev/null || true
    (cd "$dir/deploy/scale-out" && docker compose -f compose.vm2.yaml --env-file "$ENV_FILE" up -d --build --wait) \
      || { log "compose failed"; sleep 10; continue; }
  fi
  if healthy; then
    for f in ctdt-pool-gate.service ctdt-pool-sync.service; do
      cmp -s "$dir/deploy/scale-out/$f" "/etc/systemd/system/$f" || install -m644 "$dir/deploy/scale-out/$f" /etc/systemd/system/
    done
    cmp -s "$dir/deploy/scale-out/pool-sync.sh" /usr/local/sbin/ctdt-pool-sync \
      || install -m755 "$dir/deploy/scale-out/pool-sync.sh" /usr/local/sbin/ctdt-pool-sync
    systemctl daemon-reload || true
    gate_off
    ls -1dt /srv/ctdt/releases/* 2>/dev/null | tail -n +3 | xargs -r rm -rf
    log "serving $tag"
    exit 0
  fi
  log "attempt $attempt: not healthy yet"; sleep 10
done
log "gave up; :8080 stays closed to the load balancer"
exit 1
