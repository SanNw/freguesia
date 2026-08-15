# n8n Credentials

This directory documents credential configuration. **No credential files should be stored here.**

All credentials must be configured through the n8n UI (Settings > Credentials) or via the n8n API. Credential data is encrypted in the n8n database using `N8N_ENCRYPTION_KEY`.

## Required credentials for the MVP

| Credential | Type | Purpose |
| --- | --- | --- |
| Freguesia Worker Token | Header Auth | `Authorization: Bearer <WORKER_SERVICE_TOKEN>` |
| Telegram Bot API | HTTP Request Auth | Bot token from `@BotFather` |

## Notes

- Never commit credential JSON files.
- Never paste tokens in chat, screenshots, or logs.
- In production, use n8n's external secrets feature if available.
- Rotating `N8N_ENCRYPTION_KEY` will invalidate all stored credentials.
