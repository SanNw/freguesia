# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Freguesia, please report it
privately to the repository owner. Do not open a public issue.

## Core Security Rules

1. **Secrets never in Git.** Use `.env` (gitignored) or a secret manager.
2. **Secrets never in logs, screenshots, or Telegram messages.**
3. **TLS is mandatory in production.** Caddy handles automatic HTTPS.
4. **Internal API is protected by a service token** (`Authorization: Bearer <token>`).
5. **SSRF prevention:** strict domain allowlist; DNS resolution blocks private/loopback IPs.
6. **Least privilege:** the Telegram bot has only channel-post permissions.
7. **Playwright sessions are treated as passwords:** never committed, never sent to chat, encrypted at rest.
8. **Non-root containers** with `no-new-privileges`.
9. **Backups are encrypted and tested monthly.**
10. **Dependencies are pinned** — no `latest` tags in production.

See `docs/SECURITY.md` for the full threat model and controls.
