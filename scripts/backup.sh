#!/usr/bin/env bash
# Backup PostgreSQL, n8n data, and workflow exports
# Usage: ./scripts/backup.sh [BACKUP_DIR]
set -euo pipefail

BACKUP_DIR="${1:-./backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$BACKUP_DIR"

echo "Starting backup to $BACKUP_DIR..."

# PostgreSQL backup (both freguesia and n8n databases)
echo "Backing up PostgreSQL..."
docker compose exec -T postgres pg_dump -U freguesia freguesia > "$BACKUP_DIR/freguesia-db.sql"
docker compose exec -T postgres pg_dump -U n8n n8n > "$BACKUP_DIR/n8n-db.sql"

# n8n volume backup
echo "Backing up n8n data..."
docker run --rm \
  -v freguesia_n8n_data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine tar czf /backup/n8n-data.tar.gz -C /data .

# Workflow JSONs (already in git, but backup anyway)
echo "Backing up workflow exports..."
cp -r n8n/workflows "$BACKUP_DIR/workflows"

# Non-secret config
echo "Backing up config..."
cp .env.example "$BACKUP_DIR/" 2>/dev/null || true
cp compose.yaml "$BACKUP_DIR/" 2>/dev/null || true
cp infra/Caddyfile "$BACKUP_DIR/" 2>/dev/null || true

echo "Backup complete: $BACKUP_DIR"
echo "Remember to encrypt before transferring offsite."
