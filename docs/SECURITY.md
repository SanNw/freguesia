# Security — Threat Model and Controls

## Threat Model

| Threat | Impact | Control |
| --- | --- | --- |
| Telegram token leak | Bot hijack | Token in n8n credentials only; never in code/logs |
| Playwright session theft | Account impersonation | `.auth/` gitignored; encrypted at rest; dedicated account |
| SSRF via malicious product URL | Internal network access | Domain allowlist; DNS resolution blocks private/loopback IPs |
| HTML injection in caption | XSS in Telegram | Sanitize HTML; use allowed tags only |
| Fake approval callback | Unauthorized publication | Validate `from.id` against admin allowlist; idempotency keys |
| Duplicate publication | Channel spam | Unique constraint on `publications.idempotency_key` |
| Compromised dependency | Supply chain attack | Pinned versions; `npm audit` in CI; no `latest` tags |
| n8n panel exposed | Unauthorized control | Caddy auth; no public port; VPN/allowlist recommended |
| Secrets in logs | Credential leak | Pino redaction; structured logging; no raw HTML/cookies |
| Prompt injection in page content | Misleading offers | Page content is untrusted; AI cannot publish; output follows JSON schema |

## Controls Summary

1. `Authorization: Bearer <token>` on all Worker routes except health/ready
2. Strict domain allowlist for all outbound requests
3. DNS resolution + private IP blocking for SSRF prevention
4. Redirect validation with max-redirects limit
5. Telegram admin ID allowlist
6. Webhook secret validation
7. Non-root containers with `no-new-privileges`
8. Read-only filesystem where compatible
9. Encrypted backups
10. SCA/SAST in CI pipeline
11. Monthly n8n security audit
12. Health endpoints return no sensitive data
