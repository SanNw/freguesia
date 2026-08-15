# Data Retention Policy

## Overview

This document defines how long data is kept in the Freguesia platform.

## Retention Schedule

| Data | Retention | Action |
| --- | --- | --- |
| `workflow_events` | Indefinite (append-only audit) | Never delete without approved policy |
| `publications` | Indefinite | Never delete (audit trail) |
| `approvals` | Indefinite | Never delete (audit trail) |
| `offers` (expired/rejected) | 90 days | Automated daily cleanup marks as archived |
| `price_observations` | 1 year | Aggregated; raw observations pruned after 1 year |
| n8n execution data | 14 days | `EXECUTIONS_DATA_MAX_AGE=336` (hours) |
| Playwright screenshots | 7 days | Automated cleanup |
| Playwright traces | 7 days | Automated cleanup |
| Image cache | 1 hour (`IMAGE_CACHE_TTL_HOURS`) | Automated cleanup |
| Browser auth sessions | Until revoked | Manual deletion on revoke |

## Right to be Forgotten

If a user requests data deletion and the data is in audit tables, the request must be reviewed by an administrator. Audit data is never deleted without an approved exception.

## Backups

- Database backups retained for 30 days
- n8n volume backups retained for 14 days
- Backups are encrypted
- Restore is tested monthly

## Compliance

- No personal data is collected from end users
- Product data is sourced from public pages in compliance with source terms
- Telegram admin IDs are operator-controlled, not user data
