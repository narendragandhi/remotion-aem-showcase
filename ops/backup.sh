#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
umask 077
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/provenance-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --dbname="$DATABASE_URL" --format=custom --file="$backup.partial"
pg_restore --list "$backup.partial" >/dev/null
mv "$backup.partial" "$backup"
shasum -a 256 "$backup" > "$backup.sha256"
printf 'Backup created: %s\n' "$backup"
