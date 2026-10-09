# Graph Report - freguesia-github-2026-10-09  (2026-10-09)

## Corpus Check
- 179 files · ~64,302 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 32 file(s) not represented in the graph (top: (none) 30, .example 1, .dev 1)

## Summary
- 909 nodes · 2077 edges · 55 communities (38 shown, 17 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1aab8b54`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- mercadolivre.experimental.adapter.ts
- TelegramGateway
- create-manual-offer.ts
- app.py
- scripts
- Freguesia Worker domain and browser automation service
- lomadee.adapter.ts
- offer.ts
- compilerOptions
- server.ts
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
- zod
- src/index.ts
- AffiliateGenerator
- init-n8n-db.sh
- backup.sh
- export-n8n-workflows.sh
- import-n8n-workflows.sh
- restore.sh
- eslint.config.js
- worker/package.json
- publish-offer.ts
- resilientFetch
- product-niche.ts
- shopee.adapter.ts
- FeedAdapter
- handle-telegram-callback.ts
- Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?
- ref_vitest
- sync-offer-to-site.ts
- offers.ts
- telegram-gateway.ts
- devDependencies
- awin-feed.ts
- Publicação automática com roteamento seguro
- product-matching/index.ts
- publicationRepository
- ExtractedProduct
- engines

## God Nodes (most connected - your core abstractions)
1. `AppError` - 71 edges
2. `offerRepository` - 35 edges
3. `Logger` - 32 edges
4. `env` - 30 edges
5. `TelegramGateway` - 29 edges
6. `SourceAdapter` - 22 edges
7. `db` - 20 edges
8. `publishOffer()` - 20 edges
9. `AffiliateLinkResult` - 20 edges
10. `ExtractedProduct` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Publicação` --references--> `publishOffer()`  [INFERRED]
  docs/superpowers/specs/2026-08-30-automatic-publication-routing-design.md → apps/worker/src/application/publish-offer.ts
- `Automatic Publication Routing Implementation Plan` --references--> `publishOffer()`  [INFERRED]
  docs/superpowers/plans/2026-08-30-automatic-publication-routing.md → apps/worker/src/application/publish-offer.ts
- `SEO e compartilhamento` --references--> `Offer`  [INFERRED]
  docs/superpowers/specs/2026-08-29-offer-pages-seo-design.md → apps/worker/src/domain/offer.ts
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

## Communities (55 total, 17 thin omitted)

### Community 0 - "mercadolivre.experimental.adapter.ts"
Cohesion: 0.18
Nodes (11): advertiserIds(), FeedConfig, ManualAdapter, ML_ALLOWED_DOMAINS, DiscoveredProduct, DiscoveryInput, SourceAdapter, AffiliateLinkContext (+3 more)

### Community 1 - "TelegramGateway"
Cohesion: 0.19
Nodes (8): TelegramGateway, publishOffer(), requestApproval(), requestChannelApproval(), productNicheChannel(), productNicheLabel(), registerOfferRoutes(), Task 2: Separar publicação segura de revisão

### Community 2 - "create-manual-offer.ts"
Cohesion: 0.06
Nodes (65): db, IntegrationCredential, pinterestPublicationRepository, priceObservationRepository, PriceObservationRow, productRepository, ProductRow, PinterestGateway (+57 more)

### Community 3 - "app.py"
Cohesion: 0.13
Nodes (16): buscar_produto_por_url(), conectar_mercado_livre(), create_code_challenge(), inicio(), base64, bs4, dotenv, fastapi (+8 more)

### Community 4 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, auth:mercadolivre, auth:mercadolivre-affiliate, build, db:migrate, db:seed, dev, format (+9 more)

### Community 5 - "Freguesia Worker domain and browser automation service"
Cohesion: 0.07
Nodes (42): Graphify-first codebase navigation workflow, Private Docker service network, Docker Compose runtime stack, Decision to separate n8n, Worker, and PostgreSQL responsibilities, Preservation of publications, audit events, and price history, Data retention and deletion policy, Offer lifecycle state machine, Replicable architecture and operations manual (+34 more)

### Community 6 - "lomadee.adapter.ts"
Cohesion: 0.14
Nodes (17): LomadeeAdapter, LomadeeCampaign, LomadeeProduct, LomadeeProductOption, metadataNumber(), promotionRank(), selectOption(), toCents() (+9 more)

### Community 7 - "offer.ts"
Cohesion: 0.06
Nodes (32): AffiliateLink, affiliateLinkSchema, APPROVAL_DECISIONS, ApprovalDecision, Availability, AvailabilityDetail, availabilityDetailSchema, Condition (+24 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noFallthroughCasesInSwitch (+12 more)

### Community 9 - "server.ts"
Cohesion: 0.07
Nodes (25): main(), main(), browserPool, MAX_CONCURRENCY, CAPTCHA_SIGNALS, detectBlocked(), detectCaptcha(), lockPath (+17 more)

### Community 10 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, dotenv, fastify, @fastify/cors, pg, pino, pino-pretty, playwright (+1 more)

### Community 11 - "product-matching/package.json"
Cohesion: 0.09
Nodes (21): devDependencies, string-similarity, ts-node, tsx, @types/string-similarity, typescript, vitest, tsx (+13 more)

### Community 12 - "AppError"
Cohesion: 0.07
Nodes (41): assertConfigured(), base64Url(), completeMercadoLivreAuthorization(), createMercadoLivreAuthorizationUrl(), getMercadoLivreAccessToken(), requestToken(), saveToken(), TokenResponse (+33 more)

### Community 13 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noFallthroughCasesInSwitch (+8 more)

### Community 14 - "offerRepository"
Cohesion: 0.06
Nodes (21): offerRepository, Offer, calculatePriceDropPercent(), parseBRLPrice(), Automatic Publication Routing Implementation Plan, Global Constraints, Task 1: Persistir decisão de canal, Task 3: Criar aprovação com escolha de canal (+13 more)

### Community 15 - "aliexpress.adapter.ts"
Cohesion: 0.19
Nodes (17): AliExpressAdapter, aliExpressReadiness(), AliExpressReadinessReason, AliProduct, asCents(), asNumber(), asText(), generatedPromotionLink() (+9 more)

### Community 16 - "n8n-mcp"
Cohesion: 0.29
Nodes (6): mcp, n8n-mcp, command, enabled, type, $schema

### Community 17 - "product-matching/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, baseUrl, outDir, paths, extends, include, @freguesia/product-matching, ../../tsconfig.json

### Community 18 - "mercadolivre.adapter.ts"
Cohesion: 0.11
Nodes (12): CatalogItem, CatalogItemsResponse, CatalogProduct, CatalogSearchResponse, CategoryPathResponse, cents(), itemIdFromUrl(), MercadoLivreAdapter (+4 more)

### Community 20 - "contracts/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 21 - "eslint-config/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 23 - "zod"
Cohesion: 0.22
Nodes (6): booleanString, envSchema, Source, SourceId, sourceSchema, zod

### Community 24 - "src/index.ts"
Cohesion: 0.50
Nodes (3): CreateDiscoveryRunRequest, CreateDiscoveryRunResponse, errorResponse

### Community 33 - "worker/package.json"
Cohesion: 0.11
Nodes (17): description, tsx, typescript, vitest, name, private, type, version (+9 more)

### Community 35 - "publish-offer.ts"
Cohesion: 0.26
Nodes (6): workflowEventRepository, buildPublicationCaption(), buildAffiliateCaptionLink(), appendChannelsFooter(), CHANNELS_FOOTER, CHANNELS_FOOTER_TEXT

### Community 36 - "resilientFetch"
Cohesion: 0.21
Nodes (6): AwinAdapter, extractIdFromUrl(), FetchOptions, positiveInteger(), resilientFetch(), ref_node_timers

### Community 39 - "product-niche.ts"
Cohesion: 0.12
Nodes (19): ScheduledOfferResult, confidenceLabel, publicationEnv, telegramEnv, buildOfferHeadline(), cleanProductName(), stableIndex(), classifyProductNiche() (+11 more)

### Community 40 - "shopee.adapter.ts"
Cohesion: 0.18
Nodes (12): cents(), previousPrice(), ShopeeAdapter, ShopeeApiResponse, shopeeAuthorization(), ShopeeProductOffer, shopeeReadiness(), ShopeeReadinessReason (+4 more)

### Community 42 - "handle-telegram-callback.ts"
Cohesion: 0.15
Nodes (16): adminUserIds(), isAdmin(), field(), normalizeLabel(), parseAmazonCommand(), parsePrice(), AmazonTelegramMessage, handleAmazonMessage() (+8 more)

### Community 43 - "Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?, Source Nodes

### Community 44 - "ref_vitest"
Cohesion: 0.05
Nodes (32): isAllowedDomain(), isPrivateOrLoopback(), normalizeUrl(), PRIVATE_IP_PATTERNS, validateExternalUrl(), eventExists, getOffer, getProductById (+24 more)

### Community 45 - "sync-offer-to-site.ts"
Cohesion: 0.22
Nodes (11): SiteOfferRow, siteSyncRepository, buildSiteOfferPayload(), buildSiteOfferSlug(), deriveSiteSyncToken(), iso(), push(), pushSiteOffer() (+3 more)

### Community 46 - "offers.ts"
Cohesion: 0.26
Nodes (8): approvalRepository, affiliateLinkSchema, approveSchema, createDiscoveryRunSchema, createManualOfferSchema, listOffersQuerySchema, publishSchema, revalidateSchema

### Community 47 - "telegram-gateway.ts"
Cohesion: 0.24
Nodes (9): sleep(), TelegramEditMessageInput, TelegramResponse, TelegramRichMessageInput, TelegramSendPhotoInput, buildRichButtonRows(), escapeHtml(), RichButton (+1 more)

### Community 48 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, @eslint/js, prettier, tsx, @types/node, @types/pg, typescript (+3 more)

### Community 49 - "awin-feed.ts"
Cohesion: 0.29
Nodes (8): AwinFeedProduct, cents(), discountShare(), FEED_POOL_SIZE, loadAwinFeed(), parseAwinFeed(), parseCsv(), selectFeedOffers()

### Community 50 - "Publicação automática com roteamento seguro"
Cohesion: 0.20
Nodes (9): Aprovação no Telegram, Classificação, Compatibilidade, Fluxo, Objetivo, Persistência, Publicação, Publicação automática com roteamento seguro (+1 more)

### Community 51 - "product-matching/index.ts"
Cohesion: 0.33
Nodes (7): MatchConfidence, NormalizedOffer, compareOffers(), normalizeIdentifier(), normalizeTitle(), baseOffer, string-similarity

## Knowledge Gaps
- **294 isolated node(s):** `name`, `version`, `private`, `type`, `description` (+289 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 391 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `AppError` to `mercadolivre.experimental.adapter.ts`, `TelegramGateway`, `create-manual-offer.ts`, `publish-offer.ts`, `resilientFetch`, `lomadee.adapter.ts`, `product-niche.ts`, `shopee.adapter.ts`, `server.ts`, `handle-telegram-callback.ts`, `ref_vitest`, `offers.ts`, `aliexpress.adapter.ts`, `mercadolivre.adapter.ts`, `ExtractedProduct`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `zod` connect `zod` to `worker/package.json`, `offer.ts`, `AppError`, `offers.ts`, `src/index.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `string-similarity` connect `product-matching/index.ts` to `product-matching/package.json`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _294 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `create-manual-offer.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.060570762958648806 - nodes in this community are weakly interconnected._
- **Should `app.py` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._