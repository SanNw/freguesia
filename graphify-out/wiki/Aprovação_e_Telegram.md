# Aprovação e Telegram

> 75 nodes

## Key Concepts

- **publish-offer.ts** (28 connections) — `apps/worker/src/application/publish-offer.ts`
- **env.ts** (27 connections) — `apps/worker/src/config/env.ts`
- **request-approval.ts** (26 connections) — `apps/worker/src/application/request-approval.ts`
- **Env** (24 connections) — `apps/worker/src/config/env.ts`
- **handle-telegram-callback.ts** (19 connections) — `apps/worker/src/application/handle-telegram-callback.ts`
- **requestApproval()** (18 connections) — `apps/worker/src/application/request-approval.ts`
- **TelegramGateway** (16 connections) — `apps/worker/src/adapters/telegram/telegram-gateway.ts`
- **telegram-gateway.ts** (16 connections) — `apps/worker/src/adapters/telegram/telegram-gateway.ts`
- **handle-amazon-message.ts** (14 connections) — `apps/worker/src/application/handle-amazon-message.ts`
- **publishOffer()** (13 connections) — `apps/worker/src/application/publish-offer.ts`
- **telegram-poller.ts** (13 connections) — `apps/worker/src/adapters/telegram/telegram-poller.ts`
- **product-niche.ts** (13 connections) — `apps/worker/src/domain/product-niche.ts`
- **handleTelegramCallback()** (9 connections) — `apps/worker/src/application/handle-telegram-callback.ts`
- **repositories.ts** (9 connections) — `apps/worker/src/adapters/persistence/repositories.ts`
- **handleAmazonMessage()** (8 connections) — `apps/worker/src/application/handle-amazon-message.ts`
- **classifyProductNiche()** (8 connections) — `apps/worker/src/domain/product-niche.ts`
- **channels-footer.ts** (8 connections) — `apps/worker/src/domain/channels-footer.ts`
- **parseAmazonCommand()** (7 connections) — `apps/worker/src/application/amazon-command.ts`
- **offer-headline.ts** (7 connections) — `apps/worker/src/domain/offer-headline.ts`
- **PublicationRepository** (6 connections) — `apps/worker/src/adapters/persistence/repositories.ts`
- **isAdmin()** (6 connections) — `apps/worker/src/adapters/telegram/telegram-gateway.ts`
- **appendChannelsFooter()** (6 connections) — `apps/worker/src/domain/channels-footer.ts`
- **buildOfferHeadline()** (6 connections) — `apps/worker/src/domain/offer-headline.ts`
- **amazon-command.ts** (6 connections) — `apps/worker/src/application/amazon-command.ts`
- **ApprovalRepository** (5 connections) — `apps/worker/src/adapters/persistence/repositories.ts`
- *... and 50 more nodes in this community*

## Relationships

- [Serviços do Worker](Serviços_do_Worker.md) (43 shared connections)
- [Persistência de Produtos](Persistência_de_Produtos.md) (30 shared connections)
- [Adaptadores de Ofertas](Adaptadores_de_Ofertas.md) (8 shared connections)
- [Browser e Telegram Polling](Browser_e_Telegram_Polling.md) (6 shared connections)
- [Repositório de Ofertas](Repositório_de_Ofertas.md) (6 shared connections)
- [Sessões e Automação](Sessões_e_Automação.md) (2 shared connections)
- [OAuth Mercado Livre](OAuth_Mercado_Livre.md) (2 shared connections)

## Source Files

- `apps/worker/src/adapters/persistence/repositories.ts`
- `apps/worker/src/adapters/telegram/telegram-gateway.ts`
- `apps/worker/src/adapters/telegram/telegram-poller.ts`
- `apps/worker/src/application/amazon-command.ts`
- `apps/worker/src/application/handle-amazon-message.ts`
- `apps/worker/src/application/handle-telegram-callback.ts`
- `apps/worker/src/application/publish-offer.ts`
- `apps/worker/src/application/request-approval.ts`
- `apps/worker/src/config/env.ts`
- `apps/worker/src/domain/affiliate-caption-link.ts`
- `apps/worker/src/domain/channels-footer.ts`
- `apps/worker/src/domain/offer-headline.ts`
- `apps/worker/src/domain/product-niche.ts`
- `apps/worker/tests/unit/affiliate-caption-link.test.ts`
- `apps/worker/tests/unit/channels-footer.test.ts`
- `apps/worker/tests/unit/handle-amazon-message.test.ts`
- `apps/worker/tests/unit/offer-headline.test.ts`
- `apps/worker/tests/unit/product-niche.test.ts`

## Audit Trail

- EXTRACTED: 243 (96%)
- INFERRED: 11 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*