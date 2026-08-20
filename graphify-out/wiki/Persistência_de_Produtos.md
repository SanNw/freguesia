# Persistência de Produtos

> 72 nodes

## Key Concepts

- **create-manual-offer.ts** (38 connections) — `apps/worker/src/application/create-manual-offer.ts`
- **run-lomadee-discovery.ts** (34 connections) — `apps/worker/src/application/run-lomadee-discovery.ts`
- **run-aliexpress-discovery.ts** (32 connections) — `apps/worker/src/application/run-aliexpress-discovery.ts`
- **run-mercadolivre-discovery.ts** (30 connections) — `apps/worker/src/application/run-mercadolivre-discovery.ts`
- **db.ts** (19 connections) — `apps/worker/src/adapters/persistence/db.ts`
- **runLomadeeDiscovery()** (18 connections) — `apps/worker/src/application/run-lomadee-discovery.ts`
- **runAliExpressDiscovery()** (17 connections) — `apps/worker/src/application/run-aliexpress-discovery.ts`
- **db** (16 connections) — `apps/worker/src/adapters/persistence/db.ts`
- **runMercadoLivreDiscovery()** (14 connections) — `apps/worker/src/application/run-mercadolivre-discovery.ts`
- **buildCaption()** (13 connections) — `apps/worker/src/application/create-manual-offer.ts`
- **validate-offer.ts** (13 connections) — `apps/worker/src/application/validate-offer.ts`
- **createManualOffer()** (12 connections) — `apps/worker/src/application/create-manual-offer.ts`
- **scoreOffer()** (11 connections) — `apps/worker/src/application/score.ts`
- **validateOffer()** (11 connections) — `apps/worker/src/application/validate-offer.ts`
- **generateIdempotencyKey()** (10 connections) — `apps/worker/src/application/offer-helpers.ts`
- **product-repository.ts** (10 connections) — `apps/worker/src/adapters/persistence/product-repository.ts`
- **ProductRepository** (9 connections) — `apps/worker/src/adapters/persistence/product-repository.ts`
- **score.ts** (9 connections) — `apps/worker/src/application/score.ts`
- **price-observation-repository.ts** (8 connections) — `apps/worker/src/adapters/persistence/price-observation-repository.ts`
- **offer-helpers.ts** (8 connections) — `apps/worker/src/application/offer-helpers.ts`
- **PriceObservationRepository** (7 connections) — `apps/worker/src/adapters/persistence/price-observation-repository.ts`
- **offer-commerce-details.ts** (7 connections) — `apps/worker/src/domain/offer-commerce-details.ts`
- **calculateDiscountPercent()** (6 connections) — `apps/worker/src/domain/price.ts`
- **formatBRL()** (6 connections) — `apps/worker/src/domain/price.ts`
- **price.test.ts** (6 connections) — `apps/worker/tests/unit/price.test.ts`
- *... and 47 more nodes in this community*

## Relationships

- [Aprovação e Telegram](Aprovação_e_Telegram.md) (30 shared connections)
- [Serviços do Worker](Serviços_do_Worker.md) (29 shared connections)
- [Adaptadores de Ofertas](Adaptadores_de_Ofertas.md) (21 shared connections)
- [Repositório de Ofertas](Repositório_de_Ofertas.md) (9 shared connections)
- [Integrações de Afiliados](Integrações_de_Afiliados.md) (6 shared connections)
- [OAuth Mercado Livre](OAuth_Mercado_Livre.md) (4 shared connections)
- [Browser e Telegram Polling](Browser_e_Telegram_Polling.md) (2 shared connections)
- [Acesso ao Banco](Acesso_ao_Banco.md) (1 shared connections)
- [Contrato de Oferta](Contrato_de_Oferta.md) (1 shared connections)

## Source Files

- `apps/worker/src/adapters/persistence/db.ts`
- `apps/worker/src/adapters/persistence/integration-credential-repository.ts`
- `apps/worker/src/adapters/persistence/migrate.ts`
- `apps/worker/src/adapters/persistence/price-observation-repository.ts`
- `apps/worker/src/adapters/persistence/product-repository.ts`
- `apps/worker/src/adapters/persistence/seed.ts`
- `apps/worker/src/application/create-manual-offer.ts`
- `apps/worker/src/application/offer-helpers.ts`
- `apps/worker/src/application/run-aliexpress-discovery.ts`
- `apps/worker/src/application/run-lomadee-discovery.ts`
- `apps/worker/src/application/run-mercadolivre-discovery.ts`
- `apps/worker/src/application/score.ts`
- `apps/worker/src/application/validate-offer.ts`
- `apps/worker/src/domain/offer-commerce-details.ts`
- `apps/worker/src/domain/price.ts`
- `apps/worker/tests/unit/offer-commerce-details.test.ts`
- `apps/worker/tests/unit/offer-helpers.test.ts`
- `apps/worker/tests/unit/price.test.ts`
- `apps/worker/tests/unit/score.test.ts`
- `apps/worker/tests/unit/validate-offer.test.ts`

## Audit Trail

- EXTRACTED: 269 (96%)
- INFERRED: 11 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*