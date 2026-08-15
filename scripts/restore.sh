#!/usr/bin/env bash
# Restore from backup directory
# Usage: ./scripts/restore.sh [BACKUP_DIR]
set -euo pipefail

BACKUP_DIR="${1:-}"
if [ -z "$BACKUP_DIR" ]; then
  echo "Error: BACKUP_DIR required as argument" >&2
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Error: Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

echo "Restoring from $BACKUP_DIR..."

# PostgreSQL restore
echo "Restoring PostgreSQL databases..."
cat "$BACKUP_DIR/freguesia-db.sql" | docker compose exec -T postgres psql -U freguesia freguesia
cat "$BACKUP_DIR/n8n-db.sql" | docker compose exec -T postgres psql -U n8n n8n

# n8n volume restore
echo "Restoring n8n data..."
docker run --rm \
  -v freguesia_n8n_data:/data \
  -v "$BACKUP_DIR:/backup" \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/n8n-data.tar.gz -C /data"

echo "Restore complete."
echo "Restart services: docker compose restart n8n worker"
