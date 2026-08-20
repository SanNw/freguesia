# Graph Report - freguesia  (2026-08-20)

## Corpus Check
- 156 files · ~52,475 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 738 nodes · 1572 edges · 52 communities (43 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dabb8f0f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- mercadolivre.experimental.adapter.ts
- offers.ts
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
- aliexpress.adapter.ts
- command
- product-matching/tsconfig.json
- DiscoveryInput
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
- AffiliateLinkResult
- app.ts
- shopee.adapter.ts
- FeedAdapter
- publish-offer.ts
- Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?
- mercadolivre.adapter.ts
- telegram-gateway.ts
- requestApproval
- product-niche.ts
- handle-telegram-callback.ts
- runtime.ts
- url.ts

## God Nodes (most connected - your core abstractions)
1. `AppError` - 26 edges
2. `OfferRepository` - 24 edges
3. `Logger` - 24 edges
4. `SourceAdapter` - 22 edges
5. `requestApproval()` - 20 edges
6. `AffiliateLinkResult` - 20 edges
7. `ExtractedProduct` - 20 edges
8. `PriceSnapshot` - 19 edges
9. `ProductRef` - 19 edges
10. `resilientFetch()` - 19 edges

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

## Communities (52 total, 9 thin omitted)

### Community 0 - "mercadolivre.experimental.adapter.ts"
Cohesion: 0.17
Nodes (7): FeedConfig, ManualAdapter, ML_ALLOWED_DOMAINS, SourceAdapter, ExtractedProduct, PriceSnapshot, ProductRef

### Community 1 - "offers.ts"
Cohesion: 0.22
Nodes (11): ApprovalRepository, completeMercadoLivreAffiliateLink(), generateAffiliateLinkForOffer(), registerOfferRoutes(), affiliateLinkSchema, approveSchema, createDiscoveryRunSchema, createManualOfferSchema (+3 more)

### Community 2 - "create-manual-offer.ts"
Cohesion: 0.07
Nodes (52): db, IntegrationCredential, PriceObservationRepository, PriceObservationRow, ProductRepository, ProductRow, buildCaption(), createManualOffer() (+44 more)

### Community 3 - "AppError"
Cohesion: 0.17
Nodes (11): Circuit, circuits, CircuitState, getCircuit(), positiveInteger(), withCircuitBreaker(), AppError, ErrorCode (+3 more)

### Community 4 - "scripts"
Cohesion: 0.04
Nodes (45): description, devDependencies, eslint, @eslint/js, prettier, tsx, @types/node, @types/pg (+37 more)

### Community 5 - "Freguesia Worker domain and browser automation service"
Cohesion: 0.06
Nodes (42): Graphify-first codebase navigation workflow, Private Docker service network, Docker Compose runtime stack, Decision to separate n8n, Worker, and PostgreSQL responsibilities, Preservation of publications, audit events, and price history, Data retention and deletion policy, Offer lifecycle state machine, Replicable architecture and operations manual (+34 more)

### Community 6 - "lomadee.adapter.ts"
Cohesion: 0.17
Nodes (12): LomadeeAdapter, LomadeeCampaign, LomadeeProduct, LomadeeProductOption, metadataNumber(), promotionRank(), selectOption(), titleSimilarity() (+4 more)

### Community 7 - "offer.ts"
Cohesion: 0.06
Nodes (38): AffiliateLink, affiliateLinkSchema, APPROVAL_DECISIONS, ApprovalDecision, Availability, AvailabilityDetail, availabilityDetailSchema, Condition (+30 more)

### Community 8 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noFallthroughCasesInSwitch (+17 more)

### Community 9 - "affiliate-link-generator.ts"
Cohesion: 0.10
Nodes (15): main(), main(), BrowserPool, MAX_CONCURRENCY, CAPTCHA_SIGNALS, detectBlocked(), detectCaptcha(), lockPath (+7 more)

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

### Community 14 - "OfferRepository"
Cohesion: 0.21
Nodes (3): OfferRepository, Offer, calculatePriceDropPercent()

### Community 15 - "aliexpress.adapter.ts"
Cohesion: 0.19
Nodes (16): AliExpressAdapter, aliExpressReadiness(), AliExpressReadinessReason, AliProduct, asCents(), asNumber(), asText(), generatedPromotionLink() (+8 more)

### Community 16 - "command"
Cohesion: 0.15
Nodes (12): mcp, n8n-mcp, command, enabled, type, $schema, Bypass, -ExecutionPolicy (+4 more)

### Community 17 - "product-matching/tsconfig.json"
Cohesion: 0.18
Nodes (10): compilerOptions, baseUrl, outDir, paths, extends, include, @freguesia/product-matching, ./index.ts (+2 more)

### Community 18 - "DiscoveryInput"
Cohesion: 0.22
Nodes (3): MercadoLivreAdapter, DiscoveryInput, mockFetch

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

### Community 36 - "AffiliateLinkResult"
Cohesion: 0.26
Nodes (5): AwinAdapter, extractIdFromUrl(), AffiliateLinkResult, positiveInteger(), resilientFetch()

### Community 39 - "app.ts"
Cohesion: 0.17
Nodes (13): TelegramPoller, buildApp(), removeOldFiles(), runMaintenanceCleanup(), createLogger(), Logger, appEnv, serviceTokenAuth() (+5 more)

### Community 40 - "shopee.adapter.ts"
Cohesion: 0.20
Nodes (9): cents(), previousPrice(), ProductOfferResponse, ShopeeAdapter, shopeeAuthorization(), ShopeeProductOffer, shopeeReadiness(), ShopeeReadinessReason (+1 more)

### Community 42 - "publish-offer.ts"
Cohesion: 0.19
Nodes (7): PublicationRepository, WorkflowEventRepository, buildPublicationCaption(), buildAffiliateCaptionLink(), appendChannelsFooter(), CHANNELS_FOOTER, CHANNELS_FOOTER_TEXT

### Community 43 - "Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Por que Env conecta aprovação, adaptadores, persistência, OAuth, automação e Telegram?, Source Nodes

### Community 45 - "mercadolivre.adapter.ts"
Cohesion: 0.17
Nodes (10): CatalogItem, CatalogItemsResponse, CatalogProduct, CatalogSearchResponse, cents(), itemIdFromUrl(), SearchResult, mercadoLivreEnv (+2 more)

### Community 46 - "telegram-gateway.ts"
Cohesion: 0.22
Nodes (11): adminUserIds(), isAdmin(), TelegramEditMessageInput, TelegramRichMessageInput, TelegramSendPhotoInput, field(), normalizeLabel(), parseAmazonCommand() (+3 more)

### Community 47 - "requestApproval"
Cohesion: 0.23
Nodes (4): TelegramGateway, publishOffer(), requestApproval(), productNicheChannel()

### Community 48 - "product-niche.ts"
Cohesion: 0.22
Nodes (9): buildOfferHeadline(), cleanProductName(), stableIndex(), classifyProductNiche(), GENERAL_ONLY_TERMS, normalize(), ProductNiche, productNicheLabel() (+1 more)

### Community 49 - "handle-telegram-callback.ts"
Cohesion: 0.27
Nodes (7): AmazonTelegramMessage, handleTelegramCallback(), TelegramCallbackInput, telegramEnv, registerTelegramRoutes(), validWebhookSecret(), telegramCallbackSchema

### Community 50 - "runtime.ts"
Cohesion: 0.20
Nodes (8): booleanString, Env, envSchema, databaseEnv, discoveryEnv, marketplaceEnv, offerEnv, publicationEnv

### Community 51 - "url.ts"
Cohesion: 0.57
Nodes (5): isAllowedDomain(), isPrivateOrLoopback(), normalizeUrl(), PRIVATE_IP_PATTERNS, validateExternalUrl()

## Knowledge Gaps
- **224 isolated node(s):** `name`, `version`, `private`, `type`, `description` (+219 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `AppError` to `mercadolivre.experimental.adapter.ts`, `offers.ts`, `create-manual-offer.ts`, `lomadee.adapter.ts`, `app.ts`, `shopee.adapter.ts`, `publish-offer.ts`, `oauth.ts`, `mercadolivre.adapter.ts`, `aliexpress.adapter.ts`, `handle-telegram-callback.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `SourceAdapter` connect `mercadolivre.experimental.adapter.ts` to `AppError`, `AffiliateLinkResult`, `lomadee.adapter.ts`, `shopee.adapter.ts`, `FeedAdapter`, `affiliate-link-generator.ts`, `mercadolivre.adapter.ts`, `aliexpress.adapter.ts`, `DiscoveryInput`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `OfferRepository` connect `OfferRepository` to `offers.ts`, `create-manual-offer.ts`, `publish-offer.ts`, `mercadolivre.adapter.ts`, `handle-telegram-callback.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `requestApproval()` (e.g. with `.buildApprovalKeyboard()` and `.buildOfferRichMarkdown()`) actually correct?**
  _`requestApproval()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _224 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `create-manual-offer.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07075624797143784 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._