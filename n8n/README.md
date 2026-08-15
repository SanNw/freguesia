# n8n Workflows

This directory contains exported n8n workflows as JSON files. These are version-controlled and should be imported via the n8n API or UI.

## Workflows

| File | Name | Description |
| --- | --- | --- |
| `001-discover-offers.json` | WF-001 | Schedule trigger to discover new offers via Worker API |
| `002-request-approval.json` | WF-002 | Send offer to approval chat for human decision |
| `003-handle-telegram-callback.json` | WF-003 | Webhook to receive Telegram callback button presses |
| `004-publish-offer.json` | WF-004 | Publish approved offer to public Telegram channel |
| `005-monitor-health.json` | WF-005 | Monitor Worker health/readiness every 5 minutes |
| `006-cleanup.json` | WF-006 | Daily cleanup of expired offers and traces |

## Import / Export

```bash
# Export workflows from running n8n
./scripts/export-n8n-workflows.sh

# Import workflows into running n8n
./scripts/import-n8n-workflows.sh
```

## Rules

- Credentials are not included in exported workflows.
- Every workflow change must go through a PR with the exported JSON.
- Workflow JSONs must not contain hardcoded secrets or tokens.
