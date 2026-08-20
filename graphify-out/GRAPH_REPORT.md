# Graph Report - freguesia  (2026-08-20)

## Corpus Check
- 156 files · ~52,475 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 738 nodes · 1532 edges · 50 communities (41 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5aba5af`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SourceAdapter
- aliexpress.adapter.ts
- create-manual-offer.ts
- AppError
- scripts
- Freguesia Worker domain and browser automation service
- lomadee.adapter.ts
- offer.ts
- compilerOptions
- affiliate-link-generator.ts
- dependencies
- product-matching/package.json
- oauth.ts
- compilerOptions
- OfferRepository
- .discover
- command
- product-matching/tsconfig.json
- MercadoLivreAdapter
- Database
- contracts/package.json
- eslint-config/package.json
- result.ts
- source.ts
- src/index.ts
- AffiliateGenerator
- init-n8n-db.sh
- backup.sh
- export-n8n-workflows.sh
- import-n8n-workflows.sh
- restore.sh
- resilientFetch
- offers.ts
- ShopeeAdapter
- request-approval.ts
- publish-offer.ts
- Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?
- mercadolivre.adapter.ts
- handle-amazon-message.ts
- requestApproval
- product-niche.ts
- handle-telegram-callback.ts
- runtime.ts

## God Nodes (most connected - your core abstractions)
1. `AppError` - 26 edges
2. `OfferRepository` - 24 edges
3. `Logger` - 22 edges
4. `requestApproval()` - 20 edges
5. `resilientFetch()` - 19 edges
6. `runLomadeeDiscovery()` - 18 edges
7. `SourceAdapter` - 18 edges
8. `compilerOptions` - 18 edges
9. `db` - 17 edges
10. `runAliExpressDiscovery()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Private Docker service network` --implements--> `Freguesia threat model and security controls`  [INFERRED]
  compose.yaml → docs/SECURITY.md
- `Data retention and deletion policy` --shares_data_with--> `PostgreSQL source of truth`  [INFERRED]
  docs/DATA_RETENTION.md → Freguesia.md
- `Unified normalized affiliate offer contract` --conceptually_related_to--> `Freguesia Worker domain and browser automation service`  [INFERRED]
  Integração de plataformas.md → Freguesia.md
- `Pull request architecture, security, data, and quality gate` --conceptually_related_to--> `Freguesia threat model and security controls`  [INFERRED]
  .github/pull_request_template.md → docs/SECURITY.md
- `Repository security policy and vulnerability reporting` --conceptually_related_to--> `Freguesia threat model and security controls`  [INFERRED]
  SECURITY.md → docs/SECURITY.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Separated orchestration, domain execution, and durable state** — freguesia_n8n_orchestration, freguesia_worker_domain_service, freguesia_postgresql_source_of_truth [EXTRACTED 1.00]
- **Offer discovery through human approval and publication** — freguesia_n8n_orchestration, freguesia_worker_domain_service, freguesia_postgresql_source_of_truth, freguesia_telegram_human_approval [EXTRACTED 1.00]
- **Automated dependency maintenance and security verification** — github_dependabot_dependabot_configuration, github_workflows_security_dependency_audit, github_workflows_docker_build_worker_image_security, docs_security_supply_chain_security [INFERRED 0.95]

## Communities (50 total, 9 thin omitted)

### Community 0 - "SourceAdapter"
Cohesion: 0.13
Nodes (5): FeedAdapter, ManualAdapter, SourceAdapter, AffiliateLinkResult, ExtractedProduct

### Community 1 - "aliexpress.adapter.ts"
Cohesion: 0.16
Nodes (14): AliExpressReadinessReason, AliProduct, isAliExpressQueryMatch(), normalizeSearchText(), FeedConfig, ProductOfferResponse, ShopeeProductOffer, ShopeeReadinessReason (+6 more)

### Community 2 - "create-manual-offer.ts"
Cohesion: 0.07
Nodes (52): db, IntegrationCredential, PriceObservationRepository, PriceObservationRow, ProductRepository, ProductRow, buildCaption(), createManualOffer() (+44 more)

### Community 3 - "AppError"
Cohesion: 0.16
Nodes (12): Circuit, circuits, CircuitState, getCircuit(), positiveInteger(), withCircuitBreaker(), AppError, ErrorCode (+4 more)

### Community 4 - "scripts"
Cohesion: 0.04
Nodes (45): description, devDependencies, eslint, @eslint/js, prettier, tsx, @types/node, @types/pg (+37 more)

### Community 5 - "Freguesia Worker domain and browser automation service"
Cohesion: 0.06
Nodes (42): Graphify-first codebase navigation workflow, Private Docker service network, Docker Compose runtime stack, Decision to separate n8n, Worker, and PostgreSQL responsibilities, Preservation of publications, audit events, and price history, Data retention and deletion policy, Offer lifecycle state machine, Replicable architecture and operations manual (+34 more)

### Community 6 - "lomadee.adapter.ts"
Cohesion: 0.19
Nodes (11): LomadeeAdapter, LomadeeCampaign, LomadeeProduct, LomadeeProductOption, metadataNumber(), promotionRank(), selectOption(), titleSimilarity() (+3 more)

### Community 7 - "offer.ts"
Cohesion: 0.06
Nodes (38): AffiliateLink, affiliateLinkSchema, APPROVAL_DECISIONS, ApprovalDecision, Availability, AvailabilityDetail, availabilityDetailSchema, Condition (+30 more)

### Community 8 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noFallthroughCasesInSwitch (+17 more)

### Community 9 - "affiliate-link-generator.ts"
Cohesion: 0.08
Nodes (20): main(), main(), BrowserPool, MAX_CONCURRENCY, CAPTCHA_SIGNALS, detectBlocked(), detectCaptcha(), lockPath (+12 more)

### Community 10 - "dependencies"
Cohesion: 0.10
Nodes (22): buscar_produto_por_url(), conectar_mercado_livre(), create_code_challenge(), inicio(), dependencies, dotenv, fastify, @fastify/cors (+14 more)

### Community 11 - "product-matching/package.json"
Cohesion: 0.09
Nodes (22): devDependencies, string-similarity, ts-node, tsx, @types/string-similarity, typescript, vitest, tsx (+14 more)

### Community 12 - "oauth.ts"
Cohesion: 0.20
Nodes (12): assertConfigured(), base64Url(), completeMercadoLivreAuthorization(), createMercadoLivreAuthorizationUrl(), getMercadoLivreAccessToken(), requestToken(), saveToken(), TokenResponse (+4 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noFallthroughCasesInSwitch (+9 more)

### Community 15 - ".discover"
Cohesion: 0.24
Nodes (11): AliExpressAdapter, aliExpressReadiness(), asCents(), asNumber(), asText(), generatedPromotionLink(), origin(), preferNationalCandidates() (+3 more)

### Community 16 - "command"
Cohesion: 0.15
Nodes (12): mcp, n8n-mcp, command, enabled, type, $schema, Bypass, -ExecutionPolicy (+4 more)

### Community 17 - "product-matching/tsconfig.json"
Cohesion: 0.18
Nodes (10): compilerOptions, baseUrl, outDir, paths, extends, include, @freguesia/product-matching, ./index.ts (+2 more)

### Community 18 - "MercadoLivreAdapter"
Cohesion: 0.18
Nodes (4): cents(), itemIdFromUrl(), MercadoLivreAdapter, mockFetch

### Community 20 - "contracts/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 21 - "eslint-config/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 23 - "source.ts"
Cohesion: 0.50
Nodes (3): Source, SourceId, sourceSchema

### Community 24 - "src/index.ts"
Cohesion: 0.50
Nodes (3): CreateDiscoveryRunRequest, CreateDiscoveryRunResponse, errorResponse

### Community 36 - "resilientFetch"
Cohesion: 0.38
Nodes (3): AwinAdapter, extractIdFromUrl(), resilientFetch()

### Community 39 - "offers.ts"
Cohesion: 0.10
Nodes (27): TelegramPoller, buildApp(), completeMercadoLivreAffiliateLink(), generateAffiliateLinkForOffer(), removeOldFiles(), runMaintenanceCleanup(), createLogger(), Logger (+19 more)

### Community 40 - "ShopeeAdapter"
Cohesion: 0.26
Nodes (5): cents(), previousPrice(), ShopeeAdapter, shopeeAuthorization(), shopeeReadiness()

### Community 41 - "request-approval.ts"
Cohesion: 0.29
Nodes (7): TelegramEditMessageInput, TelegramRichMessageInput, TelegramSendPhotoInput, appendChannelsFooter(), CHANNELS_FOOTER, CHANNELS_FOOTER_TEXT, CHANNELS_LIST_LINK

### Community 42 - "publish-offer.ts"
Cohesion: 0.22
Nodes (4): PublicationRepository, WorkflowEventRepository, buildPublicationCaption(), buildAffiliateCaptionLink()

### Community 43 - "Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?, Source Nodes

### Community 45 - "mercadolivre.adapter.ts"
Cohesion: 0.22
Nodes (9): CatalogItem, CatalogItemsResponse, CatalogProduct, CatalogSearchResponse, SearchResult, ML_ALLOWED_DOMAINS, DiscoveredProduct, DiscoveryInput (+1 more)

### Community 46 - "handle-amazon-message.ts"
Cohesion: 0.36
Nodes (7): adminUserIds(), isAdmin(), field(), normalizeLabel(), parseAmazonCommand(), parsePrice(), handleAmazonMessage()

### Community 47 - "requestApproval"
Cohesion: 0.19
Nodes (5): TelegramGateway, handleTelegramCallback(), publishOffer(), requestApproval(), productNicheLabel()

### Community 48 - "product-niche.ts"
Cohesion: 0.22
Nodes (9): buildOfferHeadline(), cleanProductName(), stableIndex(), classifyProductNiche(), GENERAL_ONLY_TERMS, normalize(), ProductNiche, productNicheChannel() (+1 more)

### Community 49 - "handle-telegram-callback.ts"
Cohesion: 0.25
Nodes (5): ApprovalRepository, AmazonTelegramMessage, TelegramCallbackInput, telegramEnv, telegramCallbackSchema

### Community 50 - "runtime.ts"
Cohesion: 0.22
Nodes (7): booleanString, Env, envSchema, databaseEnv, discoveryEnv, offerEnv, publicationEnv

## Knowledge Gaps
- **225 isolated node(s):** `TokenResponse`, `AliProduct`, `AliExpressReadinessReason`, `SearchResult`, `CatalogProduct` (+220 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `AppError` to `aliexpress.adapter.ts`, `create-manual-offer.ts`, `lomadee.adapter.ts`, `offers.ts`, `request-approval.ts`, `publish-offer.ts`, `oauth.ts`, `mercadolivre.adapter.ts`, `handle-telegram-callback.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `OfferRepository` connect `OfferRepository` to `create-manual-offer.ts`, `offers.ts`, `request-approval.ts`, `publish-offer.ts`, `handle-telegram-callback.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `SourceAdapter` connect `SourceAdapter` to `aliexpress.adapter.ts`, `AppError`, `resilientFetch`, `lomadee.adapter.ts`, `mercadolivre.adapter.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `requestApproval()` (e.g. with `.buildApprovalKeyboard()` and `.buildOfferRichMarkdown()`) actually correct?**
  _`requestApproval()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `TokenResponse`, `AliProduct`, `AliExpressReadinessReason` to the rest of the system?**
  _225 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SourceAdapter` be split into smaller, more focused modules?**
  _Cohesion score 0.12631578947368421 - nodes in this community are weakly interconnected._
- **Should `create-manual-offer.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07043167802661474 - nodes in this community are weakly interconnected._