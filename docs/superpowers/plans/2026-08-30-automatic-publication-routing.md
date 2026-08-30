# Automatic Publication Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar automaticamente ofertas seguras, encaminhar ofertas incertas para escolha manual de canal e drenar a fila agendada em intervalos de 30 segundos.

**Architecture:** A oferta persiste um nicho de publicação opcional e sua origem. O consumidor da fila classifica cada oferta antes de publicar: decisões automáticas seguem para `publishOffer`; decisões incertas retornam à aprovação com botões de canal. Uma escolha manual é persistida e sempre prevalece sobre o classificador.

**Tech Stack:** Node.js 22, TypeScript, PostgreSQL, Fastify, Telegram Bot API, Vitest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-30-automatic-publication-routing-design.md`

## Global Constraints

- Processar no máximo uma oferta a cada 30 segundos.
- Manter limites horário e diário existentes.
- Erros permanentes recebem `failed`; vencidas recebem `expired`; erros transitórios continuam agendados.
- Classificação incerta nunca chega ao gateway sem escolha manual.
- Escolha manual de canal sempre prevalece sobre o classificador.
- Callbacks precisam ser idempotentes.

---

### Task 1: Persistir decisão de canal

**Files:**
- Modify: `database/schema.sql`
- Modify: `apps/worker/src/adapters/persistence/migrate.ts`
- Modify: `apps/worker/src/domain/offer.ts`
- Modify: `apps/worker/src/adapters/persistence/offer-repository.ts`
- Test: `apps/worker/tests/unit/offer-publication-routing.test.ts`

**Interfaces:**
- Produces: `Offer.publicationNiche`, `Offer.publicationNicheSource`.
- Produces: `offerRepository.setPublicationNiche(id, niche, source, fromStatuses): Promise<boolean>`.

- [ ] **Step 1: Write the failing repository/domain test**

Create a test that maps a database row containing `publication_niche: "fashion"` and `publication_niche_source: "manual"`, and verifies the update contract rejects a status outside `pending_approval`.

- [ ] **Step 2: Run the test to verify RED**

Run: `npm test -- --run tests/unit/offer-publication-routing.test.ts`

Expected: FAIL because the fields and repository method do not exist.

- [ ] **Step 3: Add nullable columns and domain fields**

Add idempotent migration SQL:

```sql
ALTER TABLE offers ADD COLUMN IF NOT EXISTS publication_niche TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS publication_niche_source TEXT;
```

Extend `offerSchema` with nullable strings and include both columns in every offer query and `mapRow`.

- [ ] **Step 4: Implement the atomic update**

```ts
async setPublicationNiche(
  id: string,
  niche: ProductNiche,
  source: "classifier" | "manual",
  fromStatuses: string[],
): Promise<boolean>
```

The SQL must update the two fields only when `status = ANY($4::text[])` and return exactly one row.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- --run tests/unit/offer-publication-routing.test.ts && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add database/schema.sql apps/worker/src/adapters/persistence/migrate.ts apps/worker/src/domain/offer.ts apps/worker/src/adapters/persistence/offer-repository.ts apps/worker/tests/unit/offer-publication-routing.test.ts
git commit -m "feat: persist offer publication channel"
```

### Task 2: Separar publicação segura de revisão

**Files:**
- Modify: `apps/worker/src/application/process-scheduled-offer.ts`
- Modify: `apps/worker/src/application/publish-offer.ts`
- Modify: `apps/worker/src/adapters/persistence/product-repository.ts`
- Test: `apps/worker/tests/unit/process-scheduled-offer.test.ts`

**Interfaces:**
- Consumes: `classifyProductNicheDecision(title, category)`.
- Consumes: `Offer.publicationNiche` and `Offer.publicationNicheSource`.
- Produces: `processNextScheduledOffer(logger)` that publishes safe/manual offers and requests review for uncertain offers.

- [ ] **Step 1: Add failing queue tests**

Cover these literal behaviors:

```ts
it("publishes a high-confidence scheduled offer without approval")
it("returns an uncertain scheduled offer to channel approval")
it("publishes an offer using its manual niche override")
```

Assert observable status transitions and that the publication gateway is not called for uncertainty.

- [ ] **Step 2: Run the tests to verify RED**

Run: `npm test -- --run tests/unit/process-scheduled-offer.test.ts`

- [ ] **Step 3: Implement routing decision before publication**

Load the product for the scheduled offer. If `publicationNicheSource === "manual"`, publish using that niche. Otherwise classify:

```ts
const decision = classifyProductNicheDecision(product.title, product.category);
```

For `decision.automatic === true`, persist the classifier niche and publish. Otherwise transition `scheduled -> pending_approval` and invoke the channel-review sender.

- [ ] **Step 4: Make `publishOffer` honor the persisted niche**

Use `offer.publicationNiche ?? classifyProductNiche(...)` before `productNicheChannel`. Do not change rate-limit behavior.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- --run tests/unit/process-scheduled-offer.test.ts && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/application/process-scheduled-offer.ts apps/worker/src/application/publish-offer.ts apps/worker/src/adapters/persistence/product-repository.ts apps/worker/tests/unit/process-scheduled-offer.test.ts
git commit -m "feat: route safe scheduled offers automatically"
```

### Task 3: Criar aprovação com escolha de canal

**Files:**
- Create: `apps/worker/src/application/request-channel-approval.ts`
- Modify: `apps/worker/src/adapters/telegram/telegram-gateway.ts`
- Modify: `apps/worker/src/http/schemas/index.ts`
- Test: `apps/worker/tests/unit/channel-approval.test.ts`
- Test: `apps/worker/tests/unit/telegram-rich-buttons.test.ts`

**Interfaces:**
- Produces: `requestChannelApproval(offerId, decision, logger): Promise<{messageId: number; status: string}>`.
- Produces callback data `offer:channel:<niche>:<offer-id>` and `offer:channel:discard:<offer-id>`.

- [ ] **Step 1: Write failing keyboard and sender tests**

Verify the keyboard contains exactly seven channel choices plus discard, and callback payloads stay within Telegram's 64-byte limit.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- --run tests/unit/channel-approval.test.ts tests/unit/telegram-rich-buttons.test.ts`

- [ ] **Step 3: Implement the channel keyboard**

Add buttons for `hardware`, `electronics`, `appliances`, `home_kitchen`, `beauty`, `fashion`, `general`, and `discard`. The approval caption must display suggested niche, confidence and evidence.

- [ ] **Step 4: Implement idempotent channel-review sending**

Record workflow event `offer.channel_approval_requested` and avoid sending a duplicate event for the same pending offer.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- --run tests/unit/channel-approval.test.ts tests/unit/telegram-rich-buttons.test.ts && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/application/request-channel-approval.ts apps/worker/src/adapters/telegram/telegram-gateway.ts apps/worker/src/http/schemas/index.ts apps/worker/tests/unit/channel-approval.test.ts apps/worker/tests/unit/telegram-rich-buttons.test.ts
git commit -m "feat: request publication channel approval"
```

### Task 4: Processar escolha manual de canal

**Files:**
- Modify: `apps/worker/src/application/handle-telegram-callback.ts`
- Modify: `apps/worker/src/adapters/telegram/telegram-poller.ts`
- Test: `apps/worker/tests/unit/telegram-callback.test.ts`

**Interfaces:**
- Consumes callback `offer:channel:<niche>:<offer-id>`.
- Produces atomic transition `pending_approval -> scheduled` with `publication_niche_source = "manual"`.

- [ ] **Step 1: Write failing callback tests**

Test every accepted niche through a table, then test discard and duplicate callback. Assert the stored niche literal and final status.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- --run tests/unit/telegram-callback.test.ts`

- [ ] **Step 3: Parse and validate channel callbacks**

Reject unknown niches. For a valid niche, atomically persist the manual choice and schedule the offer. Delete the approval message only after successful persistence.

- [ ] **Step 4: Handle discard idempotently**

Transition only `pending_approval -> rejected`, record the decision and acknowledge repeated callbacks as already processed.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- --run tests/unit/telegram-callback.test.ts && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/application/handle-telegram-callback.ts apps/worker/src/adapters/telegram/telegram-poller.ts apps/worker/tests/unit/telegram-callback.test.ts
git commit -m "feat: handle manual publication channel choice"
```

### Task 5: Drenar fila, migrar e reconstruir

**Files:**
- Modify: `apps/worker/src/server.ts`
- Modify: `.env.example`
- Modify: `compose.yaml` only if a new environment variable is not inherited through `env_file`.
- Test: all Worker tests.

**Interfaces:**
- Consumes: `processNextScheduledOffer(logger)`.
- Produces: worker executando um ciclo imediato no startup e ciclos subsequentes a cada 30 segundos sem sobreposição.

- [ ] **Step 1: Add a scheduler behavior test or extract a testable scheduler function**

Verify one immediate cycle, one cycle after 30 seconds, and suppression of overlapping executions using fake timers.

- [ ] **Step 2: Run scheduler test to verify RED**

Run: `npm test -- --run tests/unit/scheduled-publication-runner.test.ts`

- [ ] **Step 3: Implement immediate and periodic draining**

Start one cycle after the server begins listening, then `setInterval(..., 30_000)`. Keep the existing in-flight guard and clear the timer on shutdown.

- [ ] **Step 4: Run migration and complete verification**

```bash
npm test
npm run typecheck
npm run build
docker compose up -d --build worker
docker compose exec -T worker npm run db:migrate
docker compose ps worker
docker compose logs --tail 150 worker
```

Expected: all tests pass, build exits 0, migration exits 0, worker is healthy, and logs contain no publication-loop errors.

- [ ] **Step 5: Update the knowledge graph**

Run: `graphify update .`

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/server.ts .env.example compose.yaml graphify-out
git commit -m "feat: enable automatic scheduled publication"
```
