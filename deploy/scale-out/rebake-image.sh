#!/usr/bin/env bash
# Re-bake the autoscale image on the release VM1 just deployed (runs on VM1, started by deploy-release.sh).
#
#   1. start the golden VM (api2). Its boot sync (pool-sync.sh) pulls /srv/ctdt/release-export and builds it;
#      :8080 opens to the subnet only once that release is healthy, which is the "synced" signal here.
#   2. stop it, create "<name>-api-image-<sha7>" from it.
#   3. clone the pool's instance configuration with the new image as "<name>-api-config-<sha7>", switch the pool.
#   4. delete older images and configurations, so only the newest exists.
# If another deploy lands meanwhile, it loops until the image matches the current release.
# Auth: instance principal (rebake.tf). Log: /srv/ctdt/rebake.log. One run at a time (flock in deploy-release.sh).
set -euo pipefail

NAME="${NAME:-ctdt-demo}"
EXPORT=/srv/ctdt/release-export
export OCI_CLI_AUTH=instance_principal
OCI="${OCI_BIN:-/opt/oci-cli/bin/oci}"
log() { echo "$(date -u +%FT%TZ) rebake: $*"; }

md() { curl -fsS -H "Authorization: Bearer Oracle" "http://169.254.169.254/opc/v2/instance/$1"; }
COMP="$(md compartmentId)"
q() { "$OCI" "$@" 2>/dev/null; }

API2_ID="$(q compute instance list -c "$COMP" --display-name "$NAME-api2" --query 'data[?"lifecycle-state"!=`TERMINATED`]|[0].id' --raw-output)"
POOL_ID="$(q compute-management instance-pool list -c "$COMP" --display-name "$NAME-api-pool" --query 'data[?"lifecycle-state"!=`TERMINATED`]|[0].id' --raw-output)"
[[ "$API2_ID" == ocid1.* && "$POOL_ID" == ocid1.* ]] || { log "api2 or pool not found"; exit 1; }
API2_IP="$(q compute instance list-vnics --instance-id "$API2_ID" --query 'data[0]."private-ip"' --raw-output)"

baked=""
while :; do
  sha="$(cat "$EXPORT/current.sha")"
  [[ "$sha" == "$baked" ]] && break
  tag="${sha:0:7}"
  log "baking $tag from api2 ($API2_IP)"

  "$OCI" compute instance action --instance-id "$API2_ID" --action START --wait-for-state RUNNING >/dev/null
  ok=""
  for _ in $(seq 1 90); do
    curl -fs -m 3 -o /dev/null "http://$API2_IP:8080/api/health" && { ok=1; break; }
    sleep 10
  done
  "$OCI" compute instance action --instance-id "$API2_ID" --action SOFTSTOP --wait-for-state STOPPED >/dev/null
  [[ -n "$ok" ]] || { log "api2 never became healthy; image not changed"; exit 1; }
  [[ "$(cat "$EXPORT/current.sha")" == "$sha" ]] || { log "release changed while baking; again"; continue; }

  image="$("$OCI" compute image create -c "$COMP" --instance-id "$API2_ID" --display-name "$NAME-api-image-$tag" \
    --launch-mode PARAVIRTUALIZED --wait-for-state AVAILABLE --max-wait-seconds 3600 --query data.id --raw-output)"
  log "image $image"

  cur_cfg="$(q compute-management instance-pool get --instance-pool-id "$POOL_ID" --query 'data."instance-configuration-id"' --raw-output)"
  details="$(mktemp)"
  q compute-management instance-configuration get --instance-configuration-id "$cur_cfg" --query 'data."instance-details"' \
    | python3 -c '
import json, sys
d = json.load(sys.stdin)
ld = d["launch-details"]
ld["source-details"]["image-id"] = sys.argv[1]
(ld.get("metadata") or {}).pop("user_data", None)   # units are baked into the image; user_data would overwrite them
print(json.dumps({"instanceType": "compute", "launchDetails": {
    "compartmentId": ld["compartment-id"], "shape": ld["shape"],
    "shapeConfig": {"ocpus": ld["shape-config"]["ocpus"], "memoryInGBs": ld["shape-config"]["memory-in-gbs"]},
    "sourceDetails": {"sourceType": "image", "imageId": sys.argv[1]},
    "createVnicDetails": {"assignPublicIp": ld["create-vnic-details"]["assign-public-ip"]},
    "metadata": ld.get("metadata") or {}}}))' "$image" > "$details"
  new_cfg="$("$OCI" compute-management instance-configuration create -c "$COMP" --display-name "$NAME-api-config-$tag" \
    --instance-details "file://$details" --query data.id --raw-output)"
  rm -f "$details"
  "$OCI" compute-management instance-pool update --instance-pool-id "$POOL_ID" --instance-configuration-id "$new_cfg" \
    --wait-for-state RUNNING >/dev/null
  log "pool now on $NAME-api-config-$tag"

  for id in $(q compute-management instance-configuration list -c "$COMP" \
      --query "data[?\"display-name\"!=null && starts_with(\"display-name\", '$NAME-api-config') && id!='$new_cfg'].id" | tr -d '[]", '); do
    q compute-management instance-configuration delete --instance-configuration-id "$id" --force >/dev/null && log "deleted config $id"
  done
  for id in $(q compute image list -c "$COMP" --all \
      --query "data[?\"display-name\"!=null && starts_with(\"display-name\", '$NAME-api-image') && id!='$image'].id" | tr -d '[]", '); do
    q compute image delete --image-id "$id" --force >/dev/null && log "deleted image $id"
  done
  baked="$sha"
done
log "image is current ($baked)"
