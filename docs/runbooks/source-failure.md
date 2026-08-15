# Runbook — Source Failure

## Symptoms

- A source adapter repeatedly fails discovery or extraction
- Circuit breaker state transitions to `open`
- Alert notification sent to `ALERT_TELEGRAM_CHAT_ID`

## Investigation

1. Check `sources.last_error_code` in PostgreSQL
2. Check Worker logs for `correlationId` matching the failed run
3. Check Playwright trace/screenshot if browser-based source

## Resolution

### If captcha detected
- Do not attempt to bypass
- Mark offer as `blocked_captcha`
- Alert admin to manually login (`npm run auth:mercadolivre`)
- Consider disabling source until terms reviewed

### If session expired
- Run `npm run auth:mercadolivre` to refresh session
- Check `PLAYWRIGHT_AUTH_DIR` path is correct
- Verify session file permissions

### If selector not found
- Page layout changed; update fixtures and selectors in PR
- Verify with contract tests against new fixtures

### If rate limited
- Wait for circuit breaker reset (default 15 minutes)
- Reduce `PLAYWRIGHT_MAX_CONCURRENCY` or `SOURCE_*_MIN_INTERVAL_MS`
- Consider disabling source temporarily

## Circuit Breaker

- Failure threshold: `CIRCUIT_BREAKER_FAILURE_THRESHOLD` (default 5)
- Reset timeout: `CIRCUIT_BREAKER_RESET_TIMEOUT_SECONDS` (default 900s)
- Open circuit prevents all requests to that source until timeout
