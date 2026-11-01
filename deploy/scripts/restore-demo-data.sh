#!/usr/bin/env bash
# Loads a ctdt_real dump (and optionally the attachment folder) into the demo stack on the VM, then deploys.
#   <release>/deploy/scripts/restore-demo-data.sh /srv/ctdt/incoming/ctdt_real.dump [/srv/ctdt/incoming/files.tgz]
# The dump comes from deploy/scripts/export-demo-data.ps1. It REPLACES the demo database: every change made on
# the demo since the last restore is lost.
set -euo pipefail

ROOT=/srv/ctdt
ENV_FILE="$ROOT/demo.env"
RELEASE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DUMP="${1:?Đường dẫn tệp dump (.dump)}"
FILES_ARCHIVE="${2:-}"
PROJECT=ctdt-production

[[ -f "$DUMP" ]] || { echo "Không thấy $DUMP" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Thiếu $ENV_FILE" >&2; exit 1; }
env_value() { grep -E "^$1=" "$ENV_FILE" | cut -d= -f2-; }
DB_USER="$(env_value POSTGRES_USER)"
DB_NAME="$(env_value POSTGRES_DB)"
FILES_PATH="$(env_value FILES_PATH)"

dc() {
  RELEASE_TAG="$(basename "$RELEASE_DIR")" docker compose -p "$PROJECT" \
    -f "$RELEASE_DIR/deploy/compose.yaml" --env-file "$ENV_FILE" "$@"
}

read -r -p "Thay toàn bộ CSDL $DB_NAME trên demo bằng $DUMP? Gõ 'yes': " answer
[[ "$answer" == "yes" ]] || { echo "Hủy."; exit 1; }

echo "==> Dừng api (giữ postgres, redis)"
dc stop api 2>/dev/null || true
dc up -d --wait postgres redis

echo "==> Khôi phục $DUMP"
# --clean --if-exists replaces objects in place; the database itself (and its ICU vi-VN locale) stays.
dc exec -T postgres pg_restore -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner --no-privileges --exit-on-error < "$DUMP"
dc exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT datlocprovider::text || ' ' || datlocale FROM pg_database WHERE datname = current_database()"

if [[ -n "$FILES_ARCHIVE" ]]; then
  echo "==> Chép tệp đính kèm vào $FILES_PATH"
  sudo tar -xzf "$FILES_ARCHIVE" -C "$FILES_PATH"
  sudo chown -R 1000:1000 "$FILES_PATH" # node in the API image
fi

echo "==> Deploy release $(basename "$RELEASE_DIR")"
exec "$RELEASE_DIR/deploy/scripts/deploy-release.sh"
