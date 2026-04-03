#!/usr/bin/env bash
# backup-db.sh — dump the postgres container, gzip, upload to private S3 bucket.
#
# Old backups are expired automatically by the bucket lifecycle rule (30 days).
#
# Required env vars (set in /home/deploy/marketplace/.env on the VM):
#   POSTGRES_DB, POSTGRES_USER
#   BACKUP_ACCESS_KEY, BACKUP_SECRET_KEY
#   BACKUP_BUCKET      (default: marketplace-backups)
#   BACKUP_ENDPOINT    (default: https://s3.nl-ams.scw.cloud)
#   BACKUP_REGION      (default: nl-ams)
#
set -euo pipefail

# ── Load .env ────────────────────────────────────────────────────────────────
ENV_FILE="/home/deploy/marketplace/.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -o allexport; source "$ENV_FILE"; set +o allexport
fi

BACKUP_BUCKET="${BACKUP_BUCKET:-marketplace-backups}"
BACKUP_ENDPOINT="${BACKUP_ENDPOINT:-https://s3.nl-ams.scw.cloud}"
BACKUP_REGION="${BACKUP_REGION:-nl-ams}"

TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILENAME="backup-${TIMESTAMP}.sql.gz"
TMP_FILE="/tmp/${FILENAME}"

# ── Dump ─────────────────────────────────────────────────────────────────────
echo "[backup] dumping database ${POSTGRES_DB}…"
docker exec marketplace_db \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "${TMP_FILE}"

echo "[backup] dump size: $(du -sh "${TMP_FILE}" | cut -f1)"

# ── Upload ───────────────────────────────────────────────────────────────────
echo "[backup] uploading to s3://${BACKUP_BUCKET}/${FILENAME}…"
docker run --rm \
  -e AWS_ACCESS_KEY_ID="${BACKUP_ACCESS_KEY}" \
  -e AWS_SECRET_ACCESS_KEY="${BACKUP_SECRET_KEY}" \
  -v "${TMP_FILE}:/data/${FILENAME}:ro" \
  amazon/aws-cli \
    --endpoint-url "${BACKUP_ENDPOINT}" \
    --region "${BACKUP_REGION}" \
    s3 cp "/data/${FILENAME}" "s3://${BACKUP_BUCKET}/${FILENAME}" \
    --no-progress

rm -f "${TMP_FILE}"
echo "[backup] upload complete. Bucket lifecycle rule expires backups after 30 days."
