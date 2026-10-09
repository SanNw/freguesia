# Graph Report - freguesia-github-2026-10-09  (2026-10-09)

## Corpus Check
- 190 files · ~69,564 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 32 file(s) not represented in the graph (top: (none) 30, .example 1, .dev 1)

## Summary
- 963 nodes · 2228 edges · 53 communities (37 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `441f3dd9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SourceAdapter
- TelegramGateway
- create-manual-offer.ts
- app.py
- scripts
- Freguesia Worker domain and browser automation service
- lomadee.adapter.ts
- offer.ts
- compilerOptions
- db.ts
- dependencies
- product-matching/package.json
- AppError
- compilerOptions
- offerRepository
- aliexpress.adapter.ts
- n8n-mcp
- product-matching/tsconfig.json
- mercadolivre.adapter.ts
- Database
- contracts/package.json
- eslint-config/package.json
- result.ts
- send-performance-report.ts
- mercadolivre.experimental.adapter.ts
- AffiliateGenerator
- init-n8n-db.sh
- backup.sh
- export-n8n-workflows.sh
- import-n8n-workflows.sh
- restore.sh
- eslint.config.js
- worker/package.json
- publish-offer.ts
- awin.adapter.ts
- product-niche.ts
- shopee.adapter.ts
- circuit-breaker.ts
- runtime.ts
- Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?
- process-scheduled-offer.test.ts
- sync-offer-to-site.ts
- devDependencies
- Publicação automática com roteamento seguro
- publicationRepository
- engines
- telegram-callback.test.ts
- channel-approval.test.ts
- pinterestPublicationRepository

## God Nodes (most connected - your core abstractions)
1. `AppError` - 75 edges
2. `offerRepository` - 35 edges
3. `Logger` - 34 edges
4. `env` - 33 edges
5. `TelegramGateway` - 32 edges
6. `SourceAdapter` - 22 edges
7. `db` - 21 edges
8. `publishOffer()` - 20 edges
9. `AffiliateLinkResult` - 20 edges
10. `ExtractedProduct` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Publicação` --references--> `publishOffer()`  [INFERRED]
  docs/superpowers/specs/2026-08-30-automatic-publication-routing-design.md → apps/worker/src/application/publish-offer.ts
- `SEO e compartilhamento` --references--> `Offer`  [INFERRED]
  docs/superpowers/specs/2026-08-29-offer-pages-seo-design.md → apps/worker/src/domain/offer.ts
- `Automatic Publication Routing Implementation Plan` --references--> `publishOffer()`  [INFERRED]
  docs/superpowers/plans/2026-08-30-automatic-publication-routing.md → apps/worker/src/application/publish-offer.ts
- `Task 2: Separar publicação segura de revisão` --references--> `publishOffer()`  [INFERRED]
  docs/superpowers/plans/2026-08-30-automatic-publication-routing.md → apps/worker/src/application/publish-offer.ts
- `Task 2: Separar publicação segura de revisão` --references--> `productNicheChannel()`  [INFERRED]
  docs/superpowers/plans/2026-08-30-automatic-publication-routing.md → apps/worker/src/domain/product-niche.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Separated orchestration, domain execution, and durable state** — freguesia_n8n_orchestration, freguesia_worker_domain_service, freguesia_postgresql_source_of_truth [EXTRACTED 1.00]
- **Offer discovery through human approval and publication** — freguesia_n8n_orchestration, freguesia_worker_domain_service, freguesia_postgresql_source_of_truth, freguesia_telegram_human_approval [EXTRACTED 1.00]
- **Automated dependency maintenance and security verification** — github_dependabot_dependabot_configuration, github_workflows_security_dependency_audit, github_workflows_docker_build_worker_image_security, docs_security_supply_chain_security [INFERRED 0.95]

## Communities (53 total, 16 thin omitted)

### Community 0 - "SourceAdapter"
Cohesion: 0.12
Nodes (8): FeedAdapter, FeedConfig, ManualAdapter, SourceAdapter, AffiliateLinkResult, ExtractedProduct, PriceSnapshot, ProductRef

### Community 1 - "TelegramGateway"
Cohesion: 0.05
Nodes (45): approvalRepository, adminUserIds(), isAdmin(), sleep(), TelegramEditMessageInput, TelegramGateway, TelegramMessageRejectedError, TelegramResponse (+37 more)

### Community 2 - "create-manual-offer.ts"
Cohesion: 0.05
Nodes (61): priceObservationRepository, AwinFeedProduct, cents(), discountShare(), FEED_POOL_SIZE, loadAwinFeed(), parseAwinFeed(), parseCsv() (+53 more)

### Community 3 - "app.py"
Cohesion: 0.13
Nodes (16): buscar_produto_por_url(), conectar_mercado_livre(), create_code_challenge(), inicio(), base64, bs4, dotenv, fastapi (+8 more)

### Community 4 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, auth:mercadolivre, auth:mercadolivre-affiliate, build, db:migrate, db:seed, dev, format (+9 more)

### Community 5 - "Freguesia Worker domain and browser automation service"
Cohesion: 0.06
Nodes (46): Graphify-first codebase navigation workflow, Private Docker service network, Docker Compose runtime stack, Decision to separate n8n, Worker, and PostgreSQL responsibilities, Preservation of publications, audit events, and price history, Data retention and deletion policy, Offer lifecycle state machine, Replicable architecture and operations manual (+38 more)

### Community 6 - "lomadee.adapter.ts"
Cohesion: 0.14
Nodes (17): LomadeeAdapter, LomadeeCampaign, LomadeeProduct, LomadeeProductOption, metadataNumber(), promotionRank(), selectOption(), toCents() (+9 more)

### Community 7 - "offer.ts"
Cohesion: 0.06
Nodes (39): AffiliateLink, affiliateLinkSchema, APPROVAL_DECISIONS, ApprovalDecision, Availability, AvailabilityDetail, availabilityDetailSchema, Condition (+31 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noFallthroughCasesInSwitch (+12 more)

### Community 9 - "db.ts"
Cohesion: 0.21
Nodes (6): db, IntegrationCredential, integrationCredentialRepository, PriceObservationRow, ProductRow, ShopeeDiscoveryInput

### Community 10 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, dotenv, fastify, @fastify/cors, pg, pino, pino-pretty, playwright (+1 more)

### Community 11 - "product-matching/package.json"
Cohesion: 0.09
Nodes (21): devDependencies, string-similarity, ts-node, tsx, @types/string-similarity, typescript, vitest, tsx (+13 more)

### Community 12 - "AppError"
Cohesion: 0.06
Nodes (56): assertConfigured(), base64Url(), completeMercadoLivreAuthorization(), createMercadoLivreAuthorizationUrl(), getMercadoLivreAccessToken(), requestToken(), saveToken(), TokenResponse (+48 more)

### Community 13 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noFallthroughCasesInSwitch (+8 more)

### Community 14 - "offerRepository"
Cohesion: 0.08
Nodes (13): offerRepository, Offer, Conteúdo da página, Falhas e segurança, Fluxo de dados, Fora do escopo, Imagens e interação, Objetivo (+5 more)

### Community 15 - "aliexpress.adapter.ts"
Cohesion: 0.21
Nodes (15): AliExpressAdapter, aliExpressReadiness(), AliExpressReadinessReason, AliProduct, asCents(), asNumber(), asText(), generatedPromotionLink() (+7 more)

### Community 16 - "n8n-mcp"
Cohesion: 0.29
Nodes (6): mcp, n8n-mcp, command, enabled, type, $schema

### Community 17 - "product-matching/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, baseUrl, outDir, paths, extends, include, @freguesia/product-matching, ../../tsconfig.json

### Community 18 - "mercadolivre.adapter.ts"
Cohesion: 0.10
Nodes (16): CatalogItem, CatalogItemsResponse, CatalogProduct, CatalogSearchResponse, CategoryPathResponse, cents(), itemIdFromUrl(), MercadoLivreAdapter (+8 more)

### Community 20 - "contracts/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 21 - "eslint-config/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 23 - "send-performance-report.ts"
Cohesion: 0.09
Nodes (38): performanceReportRepository, amount, clicksSchema, count, emptyMetrics(), json(), numeric, purchaseTypes (+30 more)

### Community 24 - "mercadolivre.experimental.adapter.ts"
Cohesion: 0.07
Nodes (27): main(), main(), browserPool, MAX_CONCURRENCY, CAPTCHA_SIGNALS, detectBlocked(), detectCaptcha(), lockPath (+19 more)

### Community 33 - "worker/package.json"
Cohesion: 0.11
Nodes (17): description, tsx, typescript, vitest, name, private, type, version (+9 more)

### Community 35 - "publish-offer.ts"
Cohesion: 0.21
Nodes (7): productRepository, workflowEventRepository, buildPublicationCaption(), buildAffiliateCaptionLink(), appendChannelsFooter(), CHANNELS_FOOTER, CHANNELS_FOOTER_TEXT

### Community 36 - "awin.adapter.ts"
Cohesion: 0.18
Nodes (8): advertiserIds(), AwinAdapter, extractIdFromUrl(), DiscoveredProduct, DiscoveryInput, AffiliateLinkContext, apps_worker_tests_fixtures_awin_promotion, mockFetch

### Community 39 - "product-niche.ts"
Cohesion: 0.16
Nodes (14): buildOfferHeadline(), cleanProductName(), stableIndex(), classifyProductNiche(), classifyProductNicheDecision(), EXPLICIT_AUTOMATIC_RULES, EXPLICIT_FASHION_TERMS, FASHION_ADJACENT_BLOCKERS (+6 more)

### Community 40 - "shopee.adapter.ts"
Cohesion: 0.18
Nodes (12): cents(), previousPrice(), ShopeeAdapter, ShopeeApiResponse, ShopeeProductOffer, shopeeReadiness(), ShopeeReadinessReason, AdapterHealth (+4 more)

### Community 41 - "circuit-breaker.ts"
Cohesion: 0.38
Nodes (6): Circuit, circuits, CircuitState, getCircuit(), positiveInteger(), withCircuitBreaker()

### Community 42 - "runtime.ts"
Cohesion: 0.16
Nodes (11): performanceReportsSchema, ScheduledOfferResult, confidenceLabel, booleanString, env, envSchema, databaseEnv, publicationEnv (+3 more)

### Community 43 - "Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?, Source Nodes

### Community 44 - "process-scheduled-offer.test.ts"
Cohesion: 0.18
Nodes (10): classifyProductNicheDecision, expireScheduledOffers, findNextScheduled, getProductById, publishOffer, requestChannelApproval, setPublicationNiche, transitionStatus (+2 more)

### Community 45 - "sync-offer-to-site.ts"
Cohesion: 0.22
Nodes (11): SiteOfferRow, siteSyncRepository, buildSiteOfferPayload(), buildSiteOfferSlug(), deriveSiteSyncToken(), iso(), push(), pushSiteOffer() (+3 more)

### Community 48 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, @eslint/js, prettier, tsx, @types/node, @types/pg, typescript (+3 more)

### Community 50 - "Publicação automática com roteamento seguro"
Cohesion: 0.20
Nodes (9): Aprovação no Telegram, Classificação, Compatibilidade, Fluxo, Objetivo, Persistência, Publicação, Publicação automática com roteamento seguro (+1 more)

### Community 55 - "telegram-callback.test.ts"
Cohesion: 0.20
Nodes (9): answerCallbackQuery, deleteMessage, getByIdShort, publishOffer, recordApproval, sendMessage, setPublicationNiche, transitionStatus (+1 more)

### Community 58 - "channel-approval.test.ts"
Cohesion: 0.33
Nodes (5): eventExists, getOffer, getProductById, recordEvent, sendPhoto

## Knowledge Gaps
- **310 isolated node(s):** `name`, `version`, `private`, `type`, `description` (+305 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 407 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `AppError` to `TelegramGateway`, `create-manual-offer.ts`, `publish-offer.ts`, `awin.adapter.ts`, `lomadee.adapter.ts`, `shopee.adapter.ts`, `circuit-breaker.ts`, `runtime.ts`, `process-scheduled-offer.test.ts`, `aliexpress.adapter.ts`, `mercadolivre.adapter.ts`, `send-performance-report.ts`, `mercadolivre.experimental.adapter.ts`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `zod` connect `AppError` to `worker/package.json`, `runtime.ts`, `offer.ts`, `send-performance-report.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `env` connect `runtime.ts` to `TelegramGateway`, `create-manual-offer.ts`, `publish-offer.ts`, `product-niche.ts`, `shopee.adapter.ts`, `db.ts`, `AppError`, `sync-offer-to-site.ts`, `aliexpress.adapter.ts`, `mercadolivre.adapter.ts`, `send-performance-report.ts`, `mercadolivre.experimental.adapter.ts`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _310 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SourceAdapter` be split into smaller, more focused modules?**
  _Cohesion score 0.11576354679802955 - nodes in this community are weakly interconnected._
- **Should `TelegramGateway` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `create-manual-offer.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.054075235109717866 - nodes in this community are weakly interconnected._