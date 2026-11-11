#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Use a new isolated empty verification database}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
if [ "$RESTORE_DATABASE_URL" = "${DATABASE_URL:-}" ]; then
  echo 'Refusing to restore into the source database' >&2; exit 1
fi
pg_restore --dbname="$RESTORE_DATABASE_URL" --exit-on-error --single-transaction "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS jobs FROM render_jobs; SELECT count(*) AS events FROM render_job_events;'
