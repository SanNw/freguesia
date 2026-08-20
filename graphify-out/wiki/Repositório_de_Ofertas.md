# Repositório de Ofertas

> 16 nodes

## Key Concepts

- **OfferRepository** (22 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **offer-repository.ts** (16 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **Offer** (8 connections) — `apps/worker/src/domain/offer.ts`
- **.mapRow()** (7 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.findRecentPublishedOffer()** (4 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **calculatePriceDropPercent()** (4 connections) — `apps/worker/src/domain/price.ts`
- **.findDuplicateBySourceAndExternal()** (3 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.getByIdShort()** (3 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.getOffer()** (3 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.listOffers()** (3 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.completeAffiliateLink()** (1 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.getAffiliateCompletionData()** (1 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.insertOffer()** (1 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.isBestPromotionForProduct()** (1 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.updateAffiliateUrl()** (1 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`
- **.updateStatus()** (1 connections) — `apps/worker/src/adapters/persistence/offer-repository.ts`

## Relationships

- [Persistência de Produtos](Persistência_de_Produtos.md) (9 shared connections)
- [Serviços do Worker](Serviços_do_Worker.md) (6 shared connections)
- [Aprovação e Telegram](Aprovação_e_Telegram.md) (6 shared connections)
- [Contrato de Oferta](Contrato_de_Oferta.md) (2 shared connections)
- [Adaptadores de Ofertas](Adaptadores_de_Ofertas.md) (2 shared connections)

## Source Files

- `apps/worker/src/adapters/persistence/offer-repository.ts`
- `apps/worker/src/domain/offer.ts`
- `apps/worker/src/domain/price.ts`

## Audit Trail

- EXTRACTED: 52 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*