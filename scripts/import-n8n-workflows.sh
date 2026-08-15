#!/usr/bin/env bash
# Import all n8n workflows from JSON files in n8n/workflows/
# Usage: ./scripts/import-n8n-workflows.sh [N8N_BASE_URL] [N8N_API_KEY]
set -euo pipefail

N8N_BASE_URL="${1:-${N8N_HOST:-http://localhost:5678}}"
N8N_API_KEY="${2:-}"

if [ -z "$N8N_API_KEY" ]; then
  echo "Error: N8N_API_KEY required as second argument" >&2
  exit 1
fi

WORKFLOWS_DIR="$(dirname "$0")/../n8n/workflows"

echo "Importing workflows to $N8N_BASE_URL..."

for WF_FILE in "$WORKFLOWS_DIR"/*.json; do
  if [ ! -f "$WF_FILE" ]; then
    echo "No workflow files found."
    exit 0
  fi
  
  WF_NAME=$(jq -r '.name' "$WF_FILE")
  
  curl -sS -X POST \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$WF_FILE" \
    "$N8N_BASE_URL/api/v1/workflows" | jq -r '.name // .message' | while read -r RESULT; do
    echo "  Imported: $WF_NAME -> $RESULT"
  done
done

echo "Done."
