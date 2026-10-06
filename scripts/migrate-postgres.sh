#!/usr/bin/env bash
# migrate-postgres.sh — one-shot Postgres 16 -> 18 migration via pg_dump/pg_restore.
#
# Idempotent: does nothing once the new volume exists, or when there is no old
# volume (fresh install). Run from the repo root before `docker compose up`.
#
# The old volume and the dump file are kept for rollback. On any failure the
# new volume is removed and the original containers are restarted, so the site
# stays on Postgres 16 and the next run retries from scratch.
#
# Rollback after a successful migration (loses writes made since):
#   git revert the compose change, `docker compose up -d`.
set -euo pipefail

OLD_VOL="${OLD_VOL:-marketplace_postgres_data}"
NEW_VOL="${NEW_VOL:-marketplace_pg18_data}"
OLD_IMAGE=postgres:16-alpine
NEW_IMAGE="${NEW_IMAGE:-postgres:18-alpine}"
OLD_TMP=marketplace_pg_migrate_old
NEW_TMP=marketplace_pg_migrate_new
DUMP_DIR="${DUMP_DIR:-$HOME/pg-migration}"

log() { echo "[pg-migrate] $*"; }

if docker volume inspect "$NEW_VOL" >/dev/null 2>&1; then
  log "$NEW_VOL exists, nothing to do"; exit 0
fi
if ! docker volume inspect "$OLD_VOL" >/dev/null 2>&1; then
  log "no $OLD_VOL, fresh install, nothing to do"; exit 0
fi

if [[ -f .env ]]; then
  set -o allexport; source .env; set +o allexport
fi
DB="${POSTGRES_DB:-marketplace}"
USER_="${POSTGRES_USER:-marketplace_user}"
PASS="${POSTGRES_PASSWORD:-changeme}"

mkdir -p "$DUMP_DIR"
DUMP="$DUMP_DIR/marketplace-pg16-$(date -u +%Y%m%dT%H%M%SZ).dump"

# Containers that were running before we started, restarted on failure.
STOPPED=()
for c in marketplace_backend marketplace_db; do
  if [[ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" == "true" ]]; then
    STOPPED+=("$c")
  fi
done

cleanup_tmp() { docker rm -f "$OLD_TMP" "$NEW_TMP" >/dev/null 2>&1 || true; }

on_error() {
  log "FAILED, rolling back to Postgres 16"
  cleanup_tmp
  docker volume rm "$NEW_VOL" >/dev/null 2>&1 || true
  # Reverse order: db before backend.
  for ((i=${#STOPPED[@]}-1; i>=0; i--)); do docker start "${STOPPED[i]}" >/dev/null || true; done
  exit 1
}
trap on_error ERR

# Wait until the server accepts TCP connections. During first-time init the
# official image runs a temporary socket-only server, so TCP success means
# init is finished.
wait_ready() {
  local name=$1
  for _ in $(seq 1 60); do
    if docker exec "$name" psql -h 127.0.0.1 -U "$USER_" -d "$DB" -tAc 'select 1' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  log "$name did not become ready"; docker logs --tail 30 "$name"; return 1
}

# Exact row count per table in the public schema, one "table|count" per line.
COUNT_SQL="select table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"

log "stopping app containers: ${STOPPED[*]:-none}"
if [[ ${#STOPPED[@]} -gt 0 ]]; then docker stop "${STOPPED[@]}" >/dev/null; fi

log "starting temporary Postgres 16 on $OLD_VOL"
docker run -d --name "$OLD_TMP" -e POSTGRES_PASSWORD=unused \
  -v "$OLD_VOL":/var/lib/postgresql/data "$OLD_IMAGE" >/dev/null
wait_ready "$OLD_TMP"

log "dumping $DB to $DUMP"
docker exec "$OLD_TMP" pg_dump -U "$USER_" -d "$DB" -Fc > "$DUMP"
OLD_COUNTS="$(docker exec "$OLD_TMP" psql -U "$USER_" -d "$DB" -tAc "$COUNT_SQL")"
docker rm -f "$OLD_TMP" >/dev/null

log "initialising Postgres 18 on $NEW_VOL"
docker run -d --name "$NEW_TMP" \
  -e POSTGRES_DB="$DB" -e POSTGRES_USER="$USER_" -e POSTGRES_PASSWORD="$PASS" \
  -v "$NEW_VOL":/var/lib/postgresql "$NEW_IMAGE" >/dev/null
wait_ready "$NEW_TMP"

log "restoring"
docker exec -i "$NEW_TMP" pg_restore -U "$USER_" -d "$DB" --no-owner --role="$USER_" --exit-on-error < "$DUMP"
docker exec "$NEW_TMP" psql -U "$USER_" -d "$DB" -qc 'analyze'
NEW_COUNTS="$(docker exec "$NEW_TMP" psql -U "$USER_" -d "$DB" -tAc "$COUNT_SQL")"

if [[ "$OLD_COUNTS" != "$NEW_COUNTS" ]]; then
  log "row counts differ:"; diff <(echo "$OLD_COUNTS") <(echo "$NEW_COUNTS") || true
  false
fi
log "row counts match across $(echo "$NEW_COUNTS" | wc -l) tables"

docker rm -f "$NEW_TMP" >/dev/null
trap - ERR
log "done. Old volume $OLD_VOL and dump $DUMP kept for rollback."
