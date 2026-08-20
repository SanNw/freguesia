# Serviços do Worker

> 48 nodes

## Key Concepts

- **offers.ts** (27 connections) — `apps/worker/src/http/routes/offers.ts`
- **AppError** (26 connections) — `apps/worker/src/shared/errors.ts`
- **app.ts** (26 connections) — `apps/worker/src/app.ts`
- **errors.ts** (25 connections) — `apps/worker/src/shared/errors.ts`
- **Logger** (24 connections) — `apps/worker/src/config/logger.ts`
- **logger.ts** (24 connections) — `apps/worker/src/config/logger.ts`
- **complete-mercadolivre-affiliate-link.ts** (17 connections) — `apps/worker/src/application/complete-mercadolivre-affiliate-link.ts`
- **discovery.ts** (16 connections) — `apps/worker/src/http/routes/discovery.ts`
- **telegram.ts** (13 connections) — `apps/worker/src/http/routes/telegram.ts`
- **buildApp()** (12 connections) — `apps/worker/src/app.ts`
- **generate-mercadolivre-affiliate-link.ts** (12 connections) — `apps/worker/src/application/generate-mercadolivre-affiliate-link.ts`
- **schemas/index.ts** (12 connections) — `apps/worker/src/http/schemas/index.ts`
- **completeMercadoLivreAffiliateLink()** (8 connections) — `apps/worker/src/application/complete-mercadolivre-affiliate-link.ts`
- **registerOfferRoutes()** (8 connections) — `apps/worker/src/http/routes/offers.ts`
- **registerDiscoveryRoutes()** (7 connections) — `apps/worker/src/http/routes/discovery.ts`
- **run-maintenance-cleanup.ts** (7 connections) — `apps/worker/src/application/run-maintenance-cleanup.ts`
- **run-shopee-discovery.ts** (6 connections) — `apps/worker/src/application/run-shopee-discovery.ts`
- **auth.ts** (6 connections) — `apps/worker/src/http/middleware/auth.ts`
- **health.ts** (6 connections) — `apps/worker/src/http/routes/health.ts`
- **maintenance.ts** (6 connections) — `apps/worker/src/http/routes/maintenance.ts`
- **generateAffiliateLinkForOffer()** (5 connections) — `apps/worker/src/application/generate-mercadolivre-affiliate-link.ts`
- **registerTelegramRoutes()** (5 connections) — `apps/worker/src/http/routes/telegram.ts`
- **lomadee.adapter.integration.test.ts** (5 connections) — `apps/worker/tests/integration/adapters/lomadee.adapter.integration.test.ts`
- **runMaintenanceCleanup()** (4 connections) — `apps/worker/src/application/run-maintenance-cleanup.ts`
- **validateAffiliateUrl()** (4 connections) — `apps/worker/src/domain/affiliate-link.ts`
- *... and 23 more nodes in this community*

## Relationships

- [Aprovação e Telegram](Aprovação_e_Telegram.md) (43 shared connections)
- [Persistência de Produtos](Persistência_de_Produtos.md) (29 shared connections)
- [Adaptadores de Ofertas](Adaptadores_de_Ofertas.md) (19 shared connections)
- [Integrações de Afiliados](Integrações_de_Afiliados.md) (10 shared connections)
- [OAuth Mercado Livre](OAuth_Mercado_Livre.md) (9 shared connections)
- [Browser e Telegram Polling](Browser_e_Telegram_Polling.md) (6 shared connections)
- [Repositório de Ofertas](Repositório_de_Ofertas.md) (6 shared connections)
- [Sessões e Automação](Sessões_e_Automação.md) (3 shared connections)

## Source Files

- `apps/worker/src/app.ts`
- `apps/worker/src/application/complete-mercadolivre-affiliate-link.ts`
- `apps/worker/src/application/generate-mercadolivre-affiliate-link.ts`
- `apps/worker/src/application/run-maintenance-cleanup.ts`
- `apps/worker/src/application/run-shopee-discovery.ts`
- `apps/worker/src/config/logger.ts`
- `apps/worker/src/domain/affiliate-link.ts`
- `apps/worker/src/http/middleware/auth.ts`
- `apps/worker/src/http/routes/aliexpress.ts`
- `apps/worker/src/http/routes/discovery.ts`
- `apps/worker/src/http/routes/health.ts`
- `apps/worker/src/http/routes/maintenance.ts`
- `apps/worker/src/http/routes/offers.ts`
- `apps/worker/src/http/routes/shopee.ts`
- `apps/worker/src/http/routes/telegram.ts`
- `apps/worker/src/http/schemas/index.ts`
- `apps/worker/src/shared/errors.ts`
- `apps/worker/tests/integration/adapters/lomadee.adapter.integration.test.ts`
- `apps/worker/tests/unit/affiliate-link.test.ts`

## Audit Trail

- EXTRACTED: 244 (100%)
- INFERRED: 1 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*