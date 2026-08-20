# Graph Report - freguesia  (2026-08-20)

## Corpus Check
- 160 files · ~50,856 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 714 nodes · 1508 edges · 39 communities (31 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Adaptadores de Ofertas
- Aprovação e Telegram
- Persistência de Produtos
- Serviços do Worker
- Configuração do Worker
- Infraestrutura e Operação
- Integrações de Afiliados
- Contrato de Oferta
- Compilação TypeScript Worker
- Sessões e Automação
- Aplicações e APIs
- Pacote Product Matching
- OAuth Mercado Livre
- TypeScript Compartilhado
- Repositório de Ofertas
- Browser e Telegram Polling
- Configuração MCP
- Aliases Product Matching
- Segurança de URLs
- Acesso ao Banco
- Pacote de Contratos
- Configuração ESLint
- Resultado Funcional
- Fontes de Promoções
- Contrato de Descoberta
- Geração de Afiliados
- Inicialização n8n DB
- Backup de Dados
- Exportação de Workflows
- Importação de Workflows
- Restauração de Dados

## God Nodes (most connected - your core abstractions)
1. `AppError` - 26 edges
2. `Env` - 24 edges
3. `Logger` - 24 edges
4. `OfferRepository` - 22 edges
5. `SourceAdapter` - 22 edges
6. `AffiliateLinkResult` - 20 edges
7. `ExtractedProduct` - 20 edges
8. `PriceSnapshot` - 19 edges
9. `ProductRef` - 19 edges
10. `requestApproval()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Pull request architecture, security, data, and quality gate` --conceptually_related_to--> `Freguesia threat model and security controls`  [INFERRED]
  .github/pull_request_template.md → docs/SECURITY.md
- `Unified normalized affiliate offer contract` --conceptually_related_to--> `Freguesia Worker domain and browser automation service`  [INFERRED]
  Integração de plataformas.md → Freguesia.md
- `Data retention and deletion policy` --shares_data_with--> `PostgreSQL source of truth`  [INFERRED]
  docs/DATA_RETENTION.md → Freguesia.md
- `Repository security policy and vulnerability reporting` --conceptually_related_to--> `Freguesia threat model and security controls`  [INFERRED]
  SECURITY.md → docs/SECURITY.md
- `Private Docker service network` --implements--> `Freguesia threat model and security controls`  [INFERRED]
  compose.yaml → docs/SECURITY.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Separated orchestration, domain execution, and durable state** — freguesia_n8n_orchestration, freguesia_worker_domain_service, freguesia_postgresql_source_of_truth [EXTRACTED 1.00]
- **Offer discovery through human approval and publication** — freguesia_n8n_orchestration, freguesia_worker_domain_service, freguesia_postgresql_source_of_truth, freguesia_telegram_human_approval [EXTRACTED 1.00]
- **Automated dependency maintenance and security verification** — github_dependabot_dependabot_configuration, github_workflows_security_dependency_audit, github_workflows_docker_build_worker_image_security, docs_security_supply_chain_security [INFERRED 0.95]

## Communities (39 total, 8 thin omitted)

### Community 0 - "Adaptadores de Ofertas"
Cohesion: 0.05
Nodes (43): AliExpressAdapter, aliExpressReadiness(), AliExpressReadinessReason, AliProduct, asCents(), asNumber(), asText(), generatedPromotionLink() (+35 more)

### Community 1 - "Aprovação e Telegram"
Cohesion: 0.06
Nodes (38): ApprovalRepository, PublicationRepository, WorkflowEventRepository, adminUserIds(), isAdmin(), TelegramEditMessageInput, TelegramGateway, TelegramRichMessageInput (+30 more)

### Community 2 - "Persistência de Produtos"
Cohesion: 0.07
Nodes (47): db, IntegrationCredential, PriceObservationRepository, PriceObservationRow, ProductRepository, ProductRow, buildCaption(), createManualOffer() (+39 more)

### Community 3 - "Serviços do Worker"
Cohesion: 0.11
Nodes (28): buildApp(), completeMercadoLivreAffiliateLink(), generateAffiliateLinkForOffer(), removeOldFiles(), runMaintenanceCleanup(), runShopeeDiscovery(), Logger, validateAffiliateUrl() (+20 more)

### Community 4 - "Configuração do Worker"
Cohesion: 0.04
Nodes (45): description, devDependencies, eslint, @eslint/js, prettier, tsx, @types/node, @types/pg (+37 more)

### Community 5 - "Infraestrutura e Operação"
Cohesion: 0.06
Nodes (42): Graphify-first codebase navigation workflow, Private Docker service network, Docker Compose runtime stack, Decision to separate n8n, Worker, and PostgreSQL responsibilities, Preservation of publications, audit events, and price history, Data retention and deletion policy, Offer lifecycle state machine, Replicable architecture and operations manual (+34 more)

### Community 6 - "Integrações de Afiliados"
Cohesion: 0.08
Nodes (23): AwinAdapter, extractIdFromUrl(), LomadeeAdapter, LomadeeCampaign, LomadeeProduct, LomadeeProductOption, metadataNumber(), promotionRank() (+15 more)

### Community 7 - "Contrato de Oferta"
Cohesion: 0.06
Nodes (38): AffiliateLink, affiliateLinkSchema, APPROVAL_DECISIONS, ApprovalDecision, Availability, AvailabilityDetail, availabilityDetailSchema, Condition (+30 more)

### Community 8 - "Compilação TypeScript Worker"
Cohesion: 0.08
Nodes (25): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noFallthroughCasesInSwitch (+17 more)

### Community 9 - "Sessões e Automação"
Cohesion: 0.16
Nodes (12): main(), main(), CAPTCHA_SIGNALS, detectBlocked(), detectCaptcha(), lockPath, main(), workerRequest() (+4 more)

### Community 10 - "Aplicações e APIs"
Cohesion: 0.10
Nodes (22): buscar_produto_por_url(), conectar_mercado_livre(), create_code_challenge(), inicio(), dependencies, dotenv, fastify, @fastify/cors (+14 more)

### Community 11 - "Pacote Product Matching"
Cohesion: 0.09
Nodes (22): devDependencies, string-similarity, ts-node, tsx, @types/string-similarity, typescript, vitest, tsx (+14 more)

### Community 12 - "OAuth Mercado Livre"
Cohesion: 0.20
Nodes (12): assertConfigured(), base64Url(), completeMercadoLivreAuthorization(), createMercadoLivreAuthorizationUrl(), getMercadoLivreAccessToken(), requestToken(), saveToken(), TokenResponse (+4 more)

### Community 13 - "TypeScript Compartilhado"
Cohesion: 0.11
Nodes (17): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noFallthroughCasesInSwitch (+9 more)

### Community 14 - "Repositório de Ofertas"
Cohesion: 0.23
Nodes (3): OfferRepository, Offer, calculatePriceDropPercent()

### Community 15 - "Browser e Telegram Polling"
Cohesion: 0.19
Nodes (5): BrowserPool, MAX_CONCURRENCY, TelegramPoller, createLogger(), main()

### Community 16 - "Configuração MCP"
Cohesion: 0.15
Nodes (12): mcp, n8n-mcp, command, enabled, type, $schema, Bypass, -ExecutionPolicy (+4 more)

### Community 17 - "Aliases Product Matching"
Cohesion: 0.18
Nodes (10): compilerOptions, baseUrl, outDir, paths, extends, include, @freguesia/product-matching, ./index.ts (+2 more)

### Community 18 - "Segurança de URLs"
Cohesion: 0.57
Nodes (5): isAllowedDomain(), isPrivateOrLoopback(), normalizeUrl(), PRIVATE_IP_PATTERNS, validateExternalUrl()

### Community 20 - "Pacote de Contratos"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 21 - "Configuração ESLint"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 23 - "Fontes de Promoções"
Cohesion: 0.50
Nodes (3): Source, SourceId, sourceSchema

### Community 24 - "Contrato de Descoberta"
Cohesion: 0.50
Nodes (3): CreateDiscoveryRunRequest, CreateDiscoveryRunResponse, errorResponse

## Knowledge Gaps
- **218 isolated node(s):** `name`, `version`, `private`, `type`, `description` (+213 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Env` connect `Aprovação e Telegram` to `Adaptadores de Ofertas`, `Persistência de Produtos`, `Serviços do Worker`, `Sessões e Automação`, `OAuth Mercado Livre`, `Browser e Telegram Polling`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `AppError` connect `Serviços do Worker` to `Adaptadores de Ofertas`, `Aprovação e Telegram`, `Persistência de Produtos`, `Integrações de Afiliados`, `OAuth Mercado Livre`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `SourceAdapter` connect `Adaptadores de Ofertas` to `Integrações de Afiliados`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _218 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Adaptadores de Ofertas` be split into smaller, more focused modules?**
  _Cohesion score 0.051515151515151514 - nodes in this community are weakly interconnected._
- **Should `Aprovação e Telegram` be split into smaller, more focused modules?**
  _Cohesion score 0.056576576576576575 - nodes in this community are weakly interconnected._
- **Should `Persistência de Produtos` be split into smaller, more focused modules?**
  _Cohesion score 0.06924882629107981 - nodes in this community are weakly interconnected._