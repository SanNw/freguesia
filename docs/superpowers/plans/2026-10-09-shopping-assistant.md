# Shopping Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox syntax.

**Goal:** Entregar acompanhamento de produtos e comparação no bot com botões e mensagens efêmeras.

**Architecture:** Serviços de assinatura/comparação separados do transporte Telegram. PostgreSQL guarda consentimento e fila deduplicada; n8n consulta/despacha. O poller diferencia interações `shop:` de aprovações `offer:`.

**Tech Stack:** TypeScript, Fastify, PostgreSQL, Telegram Bot API 10.3, n8n, Vitest; sem dependências novas.

**Spec:** docs/superpowers/specs/2026-10-09-shopping-assistant-design.md

## Global Constraints

- Prefixar comandos de shell com `rtk`; editar arquivos com apply_patch.
- Não modificar Docker, banco real, canais ou repositório remoto nos workers; o controlador faz backup, implantação e GitHub MCP.
- Sem novos pacotes, sem mudar o provider principal do Codex, sem subagentes criados pelos workers.
- Escrever e executar testes significativos antes da implementação; formatar os arquivos alterados.
- Correspondência exata, isolamento por usuário, somente links próprios de afiliado, sem métricas/especificações inventadas.
- RichText nativo; efêmeras usam `ephemeral_message_parameters.receiver_user_id` e `callback_query_id` do clique real.
- Flags novas desativadas por padrão. Somente handlers públicos `shop:` novos; aprovações administrativas permanecem protegidas.

---

### Task 1: Assinaturas, identidade segura e alertas

**Owned files:** Criar `apps/worker/src/domain/product-watch.ts`, `apps/worker/src/shared/product-watch-url.ts`, `apps/worker/src/adapters/persistence/product-watch-repository.ts`, `apps/worker/src/adapters/sources/watched-product-source.ts`, `apps/worker/src/application/product-watch-service.ts` e testes próprios `tests/unit/product-watch*.test.ts`. Não alterar arquivos existentes nesta tarefa.

**Interfaces produzidas**, todas exportadas:

```ts
// domain/product-watch.ts
interface ProductIdentity { key: string; store: string; itemId: string; shopId?: string; variantId?: string; canonicalUrl: string }
function parseProductIdentity(raw: string): ProductIdentity | null;
// application/product-watch-service.ts
interface WatchItem { id: string; title: string; canonicalUrl: string; active: boolean; monitoring: string }
interface WatchConfirmation extends WatchItem { alreadyWatching: boolean }
interface PublicOfferProduct { offerId: string; title: string; canonicalUrl: string; affiliateUrl: string | null; currentPriceCents: number | null; productKey: string }
function startShopper(chatId: number): Promise<void>;
function hasStartedShopper(chatId: number): Promise<boolean>;
function subscribeOffer(chatId: number, offerId: string): Promise<WatchConfirmation>;
function subscribeUrl(chatId: number, rawUrl: string): Promise<WatchConfirmation>;
function listProductWatches(chatId: number): Promise<WatchItem[]>;
function removeProductWatch(chatId: number, watchId: string): Promise<boolean>;
function getPublicOfferProduct(offerId: string): Promise<PublicOfferProduct | null>;
function dispatchProductWatches(logger: Logger, limit?: number): Promise<{ checked: number; sent: number; unavailable: number }>;
// persistence module exports a DDL string named productWatchesSchema,
// including user/sessions/watches/notification tables; migration called by Task 3.
```

**Step 1 — Tests RED**

- [ ] Tests cover matching by store/item rather than title and safe URL resolution.

```ts
expect(parseProductIdentity('https://shopee.com.br/product/12/34?utm_source=x')?.key).toBe('shopee:12:34');
expect(parseProductIdentity('https://www.kabum.com.br/produto/12345/placa')?.key).toBe('kabum:12345');
expect(parseProductIdentity('https://shopee.com.br.evil.test/product/12/34')).toBeNull();
// Also test different shop IDs/explicit variants, no private DNS redirect,
// own-user unsubscribe, duplicate notifications and input referral != output affiliate.
```

- [ ] Run `rtk proxy npm test -- tests/unit/product-watch.test.ts` and record expected failures.

**Step 2 — Implementation**

- [ ] Implement exact identity for supported stores, public HTTPS redirect resolution with pinned public DNS, positive safe Telegram IDs and a 20-watch cap enforced atomically.
- [ ] Implement additive DDL and parameterized queries. The notification reservation is unique and cannot be recreated on ambiguous transport failure. Definite 4xx refusals can retry after correction; 403 blocks delivery to that user. Removing an alert uses both its ID and actor chat ID.
- [ ] Implement lookup from published offers and direct URL registration, baseline suppression for an already-seen publication, eligible catalog catch-up, and direct Shopee checks using existing signing helper. Direct checks validate the returned shop/item and reject uncertain variant prices; link generation uses project credentials. Other unsupported direct lookups keep a clear catalog-wait state.
- [ ] Dispatcher checks at most 20 products and sends at most 20 messages per run using `TelegramGateway.sendRichMessage(..., {retryAmbiguousErrors:false})`. It must not block public publication, require any admin approval action from customers, or send user-supplied affiliate links.

**Step 3 — GREEN and report**

- [ ] Focused tests pass, then `npm run build` and `npm run lint`. Record RED/GREEN output, changed files, actual limitations and exact exported contracts in task-1-report.md. No commit/push here; root uses GitHub MCP after integration.

### Task 2: Comparação verificável de produtos

**Owned files:** Criar `apps/worker/src/domain/product-comparison.ts`, `apps/worker/src/domain/technical-product-profiles.ts`, `apps/worker/src/adapters/persistence/product-comparison-repository.ts`, `apps/worker/src/application/product-comparison-service.ts` e `tests/unit/product-comparison*.test.ts`. Não alterar arquivos da Task 1 ou existentes.

**Interfaces produzidas:**

```ts
interface ComparisonChoice { offerId: string; title: string; affiliateUrl: string; side: 'left' | 'right' }
interface ComparisonResult { markdown: string; choices: ComparisonChoice[] }
function parseComparisonCommand(text: string): { left: string; right: string } | null;
function compareProducts(left: string, right: string): Promise<ComparisonResult>;
function comparisonSuggestions(offerId: string): Promise<{ left: string; title: string; choices: Array<{ query: string; label: string }> }>;
```

`left`/`right` aceitam nomes de modelos ou a referência interna `offer:UUID`. Comparação não precisa fazer requests a URLs digitadas; URLs individuais passam pelo fluxo de acompanhamento. Consultas de catálogo retornam apenas ofertas com afiliado próprio, preço positivo, aprovação/estoque e validade confirmados. Sem preço/oferta, declarar indisponibilidade; zero não representa um preço desconhecido.

**Step 1 — RED**

```ts
expect(parseComparisonCommand('/comparar RX 550 vs GTX 1050 Ti')).toEqual({left:'RX 550',right:'GTX 1050 Ti'});
expect(parseComparisonCommand('/comparar RX 550')).toBeNull();
// Verify RX 550 != RX 5500; GTX 1050 Ti != GTX 1050.
// Unknown price -> explicit missing data, not R$0; untrusted markup escaped.
```

- [ ] Run focused failing tests before code.

**Step 2 — Implementation**

- [ ] Source the RX 550 and GTX 1050 Ti reference facts from AMD/NVIDIA or original board-maker datasheets. Browse primary sources; persist URLs/date and qualify variant-dependent memory, consumption, connectors. Do not manufacture FPS/percentages or infer cross-architecture performance from core counts. Unknown products compare catalog information with explicit technical gaps.
- [ ] Render a compact Rich Markdown table, evidence links, practical limitations and valid prices when available. Return at most three existing catalog choices per side for buttons. Distinguish accessories from GPUs and reject expired/rejected/unaffiliated offers. No shopping callbacks/Telegram sends in this task.
- [ ] Provide suggestions for a published offer from known compatible model profiles or real catalog candidates; with no candidates, allow UI to request a second product name instead of inventing it.

**Step 3 — GREEN and report**

- [ ] Run focused tests, build and lint; report sources, coverage, exports and limitations in task-2-report.md. No commit/push or live mutations.

### Task 3: Botões, efêmeras e integração

**Owned files:** Novos `src/application/handle-shopper-interaction.ts`, `src/adapters/persistence/shopper-session-repository.ts` se necessário, `src/domain/shopper-ui.ts`, `src/http/routes/product-watches.ts`, testes unitários; modificar Gateway, poller, Telegram callbacks/webhook, schemas, app, env/runtime, publication buttons, migrate/schema.sql; criar `n8n/workflows/011-product-watch-alerts.json`, `.env.example`, docs/SHOPPING-ASSISTANT.md e README.

**Interfaces consumidas:** Usar literalmente todos os exports das Tasks 1/2; garantir implementação de `productWatchesSchema` antes de rodar migration. Não criar comparação ou monitoramento paralelos que ignorem esses serviços.

**Step 1 — RED**

```ts
// Non-admin /start -> Rich menu; /amazon and /editar unchanged.
// shop callback from channel -> ephemeral receiver=callback.from.id.
// shop removal cannot mutate another user's subscription.
// offer approval still rejects non-admins.
// Payloads <=64 bytes; unknown expired selection gets safe recovery menu.
```

- [ ] Focused tests fail before wiring.

**Step 2 — Implementation**

- [ ] Add `sendEphemeralRichMessage` and `editEphemeralRichMessage` with current API's nested parameters. Never invent callback IDs or replace a shared original message publicly. Ephemeral callbacks edit their own ephemeral message rather than requesting replacement again. Only a safe ephemeral popup/toast fallback is acceptable; never broadcast interests to the channel.
- [ ] Register public shopping handlers before administrative ones, for both poller and webhook. Validate private chat/from ownership for text and session selection; source channel callbacks must correspond to an actual published offer in that channel. Do not expose admin reports or mutate approval state through `shop:`.
- [ ] Add Acompanhar/Comparar buttons to new public offers in both Rich and photo fallback paths. Use the configured bot username for start links. Private menus offer Alertas, Novo alerta, Comparar and Canais; buttons initiate URL entry or second comparison choice. Keep selection sessions per user with expiry of 15 minutes.
- [ ] Export handler contracts for tests and actual callers; `/start watch_UUID`, `/start compare_UUID`, `/alertas`, `/acompanhar URL`, direct product URL and `/comparar A vs B` all work. Menus prioritize buttons; durable confirmations/alerts stay private. Use existing Rich rendering, escaping untrusted text.
- [ ] Protected `/v1/product-watches/dispatch` POST calls dispatcher, maximum limit=20. WF-011 runs every five minutes, timezone Sao Paulo, retry-safe; versioned inactive. `SHOPPING_ASSISTANT_ENABLED=false`, `TELEGRAM_BOT_USERNAME=''` defaults. Runtime production will set true and actual username; documentation explains store coverage and source outages.

**Step 3 — GREEN, integration and documentation**

- [ ] Run focused tests then all worker tests, build, lint and format checks for touched files. Update the graph after code edits. Document own bot configuration and opt-out; do not store live chats/credentials in repository.
- [ ] Write task-3-report.md with actual evidence. Root performs independent whole-change review, backup/migration, image deployment, own-private-menu and callback tests, WF-011 activation, commit/push via GitHub MCP and remote/local clean-tree verification. No fictitious offers are published during verification.
