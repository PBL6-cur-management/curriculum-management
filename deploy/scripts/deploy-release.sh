#!/usr/bin/env bash
# Deploys the release this script ships in, on the demo VM. CD extracts `git archive <sha>` into
# /srv/ctdt/releases/<sha> and runs <that dir>/deploy/scripts/deploy-release.sh. Also runnable by hand:
#   /srv/ctdt/releases/<sha>/deploy/scripts/deploy-release.sh
# Builds the images on the VM, applies migrations, replaces api + caddy, checks health through Caddy, and on
# failure puts the previous release back. It never removes a volume: the database lives there.
set -euo pipefail

ROOT=/srv/ctdt
ENV_FILE="$ROOT/demo.env"
RELEASE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SHA="$(basename "$RELEASE_DIR")"
PROJECT=ctdt-production
KEEP_RELEASES=3
HEALTH_TRIES=36 # x 5 s = 3 minutes

[[ -f "$ENV_FILE" ]] || { echo "Thiếu $ENV_FILE (xem deploy/demo.env.example)." >&2; exit 1; }
[[ "$RELEASE_DIR" == "$ROOT/releases/"* ]] || { echo "Release phải nằm trong $ROOT/releases/." >&2; exit 1; }

exec 9>"$ROOT/.deploy.lock"
flock -n 9 || { echo "Một lần deploy khác đang chạy." >&2; exit 1; }

PUBLIC_HOST="$(grep -E '^PUBLIC_HOST=' "$ENV_FILE" | cut -d= -f2-)"
PREVIOUS_DIR="$(readlink -f "$ROOT/current" 2>/dev/null || true)"

dc() {
  local dir="$1"
  shift
  RELEASE_TAG="$(basename "$dir")" docker compose -p "$PROJECT" \
    -f "$dir/deploy/compose.yaml" --env-file "$ENV_FILE" "$@"
}

healthy_through_caddy() {
  # --resolve: test this VM even if DNS is cached elsewhere; the certificate must still be valid.
  for _ in $(seq 1 "$HEALTH_TRIES"); do
    if curl -fsS --max-time 5 --resolve "$PUBLIC_HOST:443:127.0.0.1" \
      "https://$PUBLIC_HOST/api/health" | grep -q '"status":"ok"'; then
      return 0
    fi
    sleep 5
  done
  return 1
}

echo "==> Deploy $SHA (trước đó: ${PREVIOUS_DIR:+$(basename "$PREVIOUS_DIR")})"
dc "$RELEASE_DIR" config --quiet
dc "$RELEASE_DIR" build migrate api caddy
dc "$RELEASE_DIR" up -d --wait postgres redis
dc "$RELEASE_DIR" run --rm migrate
# --no-deps: migrate already ran above; --wait: returns once the api healthcheck passes.
if dc "$RELEASE_DIR" up -d --no-deps --wait --wait-timeout 180 api caddy && healthy_through_caddy; then
  ln -sfn "$RELEASE_DIR" "$ROOT/current"
  echo "==> OK: https://$PUBLIC_HOST chạy $SHA"
else
  echo "==> Health không đạt cho $SHA." >&2
  dc "$RELEASE_DIR" logs --tail 80 api caddy >&2 || true
  if [[ -n "$PREVIOUS_DIR" && "$PREVIOUS_DIR" != "$RELEASE_DIR" ]]; then
    echo "==> Quay lại $(basename "$PREVIOUS_DIR") (migration đã chạy thì không đảo ngược)." >&2
    dc "$PREVIOUS_DIR" up -d --no-deps --wait --wait-timeout 180 api caddy || true
  fi
  exit 1
fi

# Keep the newest releases (and the current one); drop older folders and their images. Volumes untouched.
mapfile -t KEEP < <(ls -1t "$ROOT/releases" | head -n "$KEEP_RELEASES")
for dir in "$ROOT"/releases/*; do
  name="$(basename "$dir")"
  [[ " ${KEEP[*]} " == *" $name "* || "$dir" == "$RELEASE_DIR" ]] && continue
  rm -rf "$dir"
done
docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '^ctdt/' | while read -r image; do
  tag="${image##*:}"
  [[ -d "$ROOT/releases/$tag" ]] || docker image rm "$image" >/dev/null || true
done
docker image prune -f >/dev/null
echo "==> Giữ lại: ${KEEP[*]}"
