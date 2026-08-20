# Browser e Telegram Polling

> 15 nodes

## Key Concepts

- **server.ts** (13 connections) — `apps/worker/src/server.ts`
- **BrowserPool** (8 connections) — `apps/worker/src/adapters/browser/browser-pool.ts`
- **TelegramPoller** (6 connections) — `apps/worker/src/adapters/telegram/telegram-poller.ts`
- **main()** (5 connections) — `apps/worker/src/server.ts`
- **browser-pool.ts** (5 connections) — `apps/worker/src/adapters/browser/browser-pool.ts`
- **.loop()** (4 connections) — `apps/worker/src/adapters/telegram/telegram-poller.ts`
- **.start()** (3 connections) — `apps/worker/src/adapters/telegram/telegram-poller.ts`
- **createLogger()** (3 connections) — `apps/worker/src/config/logger.ts`
- **.acquire()** (2 connections) — `apps/worker/src/adapters/browser/browser-pool.ts`
- **.getBrowser()** (2 connections) — `apps/worker/src/adapters/browser/browser-pool.ts`
- **.constructor()** (2 connections) — `apps/worker/src/adapters/telegram/telegram-poller.ts`
- **.stop()** (2 connections) — `apps/worker/src/adapters/telegram/telegram-poller.ts`
- **.close()** (1 connections) — `apps/worker/src/adapters/browser/browser-pool.ts`
- **.release()** (1 connections) — `apps/worker/src/adapters/browser/browser-pool.ts`
- **MAX_CONCURRENCY** (1 connections) — `apps/worker/src/adapters/browser/browser-pool.ts`

## Relationships

- [Aprovação e Telegram](Aprovação_e_Telegram.md) (6 shared connections)
- [Serviços do Worker](Serviços_do_Worker.md) (6 shared connections)
- [Sessões e Automação](Sessões_e_Automação.md) (2 shared connections)
- [Adaptadores de Ofertas](Adaptadores_de_Ofertas.md) (2 shared connections)
- [Persistência de Produtos](Persistência_de_Produtos.md) (2 shared connections)

## Source Files

- `apps/worker/src/adapters/browser/browser-pool.ts`
- `apps/worker/src/adapters/telegram/telegram-poller.ts`
- `apps/worker/src/config/logger.ts`
- `apps/worker/src/server.ts`

## Audit Trail

- EXTRACTED: 36 (95%)
- INFERRED: 2 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*