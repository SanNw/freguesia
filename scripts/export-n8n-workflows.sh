#!/usr/bin/env bash
# Export all n8n workflows to JSON files in n8n/workflows/
# Usage: ./scripts/export-n8n-workflows.sh [N8N_BASE_URL] [N8N_API_KEY]
set -euo pipefail

N8N_BASE_URL="${1:-${N8N_HOST:-http://localhost:5678}}"
N8N_API_KEY="${2:-}"

if [ -z "$N8N_API_KEY" ]; then
  echo "Error: N8N_API_KEY required as second argument" >&2
  exit 1
fi

OUTPUT_DIR="$(dirname "$0")/../n8n/workflows"
mkdir -p "$OUTPUT_DIR"

echo "Exporting workflows from $N8N_BASE_URL..."

WORKFLOWS=$(curl -sS -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_BASE_URL/api/v1/workflows" | jq -r '.data[].id')

for WF_ID in $WORKFLOWS; do
  WF_NAME=$(curl -sS -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_BASE_URL/api/v1/workflows/$WF_ID" | jq -r '.name')
  
  SAFE_NAME=$(echo "$WF_NAME" | sed 's/[^a-zA-Z0-9-]/-/g' | tr '[:upper:]' '[:lower:]')
  OUTPUT_FILE="$OUTPUT_DIR/${SAFE_NAME}.json"
  
  curl -sS -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_BASE_URL/api/v1/workflows/$WF_ID" | jq '.' > "$OUTPUT_FILE"
  
  echo "  Exported: $WF_NAME -> $OUTPUT_FILE"
done

echo "Done."
