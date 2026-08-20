# Sessões e Automação

> 25 nodes

## Key Concepts

- **affiliate-link-generator.ts** (15 connections) — `apps/worker/src/adapters/mercadolivre/affiliate-link-generator.ts`
- **SessionStore** (11 connections) — `apps/worker/src/adapters/browser/session-store.ts`
- **generateMercadoLivreAffiliateLink()** (8 connections) — `apps/worker/src/adapters/mercadolivre/affiliate-link-generator.ts`
- **detectBlocked()** (7 connections) — `apps/worker/src/adapters/browser/captcha-detector.ts`
- **detectCaptcha()** (7 connections) — `apps/worker/src/adapters/browser/captcha-detector.ts`
- **.pathFor()** (7 connections) — `apps/worker/src/adapters/browser/session-store.ts`
- **.save()** (6 connections) — `apps/worker/src/adapters/browser/session-store.ts`
- **captcha-detector.ts** (6 connections) — `apps/worker/src/adapters/browser/captcha-detector.ts`
- **process-mercadolivre-affiliate-queue.ts** (5 connections) — `apps/worker/src/adapters/browser/process-mercadolivre-affiliate-queue.ts`
- **session-store.ts** (5 connections) — `apps/worker/src/adapters/browser/session-store.ts`
- **main()** (4 connections) — `apps/worker/src/adapters/browser/process-mercadolivre-affiliate-queue.ts`
- **.load()** (4 connections) — `apps/worker/src/adapters/browser/session-store.ts`
- **main()** (3 connections) — `apps/worker/src/adapters/browser/auth-mercadolivre-affiliate.ts`
- **main()** (3 connections) — `apps/worker/src/adapters/browser/auth-mercadolivre.ts`
- **findGeneratedLink()** (3 connections) — `apps/worker/src/adapters/mercadolivre/affiliate-link-generator.ts`
- **auth-mercadolivre.ts** (3 connections) — `apps/worker/src/adapters/browser/auth-mercadolivre.ts`
- **auth-mercadolivre-affiliate.ts** (3 connections) — `apps/worker/src/adapters/browser/auth-mercadolivre-affiliate.ts`
- **captcha-detector.test.ts** (3 connections) — `apps/worker/tests/unit/captcha-detector.test.ts`
- **workerRequest()** (2 connections) — `apps/worker/src/adapters/browser/process-mercadolivre-affiliate-queue.ts`
- **.delete()** (2 connections) — `apps/worker/src/adapters/browser/session-store.ts`
- **.exists()** (2 connections) — `apps/worker/src/adapters/browser/session-store.ts`
- **isGeneratedLink()** (2 connections) — `apps/worker/src/adapters/mercadolivre/affiliate-link-generator.ts`
- **.constructor()** (1 connections) — `apps/worker/src/adapters/browser/session-store.ts`
- **CAPTCHA_SIGNALS** (1 connections) — `apps/worker/src/adapters/browser/captcha-detector.ts`
- **lockPath** (1 connections) — `apps/worker/src/adapters/browser/process-mercadolivre-affiliate-queue.ts`

## Relationships

- [Adaptadores de Ofertas](Adaptadores_de_Ofertas.md) (9 shared connections)
- [Serviços do Worker](Serviços_do_Worker.md) (3 shared connections)
- [Aprovação e Telegram](Aprovação_e_Telegram.md) (2 shared connections)
- [Browser e Telegram Polling](Browser_e_Telegram_Polling.md) (2 shared connections)

## Source Files

- `apps/worker/src/adapters/browser/auth-mercadolivre-affiliate.ts`
- `apps/worker/src/adapters/browser/auth-mercadolivre.ts`
- `apps/worker/src/adapters/browser/captcha-detector.ts`
- `apps/worker/src/adapters/browser/process-mercadolivre-affiliate-queue.ts`
- `apps/worker/src/adapters/browser/session-store.ts`
- `apps/worker/src/adapters/mercadolivre/affiliate-link-generator.ts`
- `apps/worker/tests/unit/captcha-detector.test.ts`

## Audit Trail

- EXTRACTED: 57 (88%)
- INFERRED: 8 (12%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*