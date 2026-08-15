# Freguesia — Especificação Técnica Completa da Automação de Ofertas com n8n

> Documento de arquitetura, implementação, segurança, operação e qualidade para permitir que outra IA ou equipe técnica construa a plataforma **Freguesia** sem depender do histórico desta conversa.

**Status:** especificação proposta para MVP e evolução em produção  
**Data de referência:** 15 de agosto de 2026  
**Idioma operacional:** português do Brasil  
**Fuso horário:** `America/Sao_Paulo`  
**Plataforma principal:** n8n self-hosted  
**Objetivo de negócio:** localizar promoções, validar dados, gerar links de afiliado quando permitido, obter a imagem do produto e publicar ofertas em um canal do Telegram.

---

## 1. Resumo executivo

A Freguesia será uma plataforma de curadoria e publicação de ofertas. A solução não deve ser implementada como um único script nem como um agente de IA com liberdade irrestrita. A arquitetura final recomendada separa responsabilidades:

1. **n8n** orquestra horários, etapas, retries, aprovação humana e publicação.
2. **Freguesia Worker**, escrito em Node.js + TypeScript, executa navegação com Playwright, normaliza produtos, manipula sessões autenticadas e expõe uma API interna estável.
3. **PostgreSQL** mantém ofertas, histórico de preços, fontes, status de aprovação, publicações e auditoria.
4. **Telegram Bot API** recebe aprovações e publica no canal.
5. **APIs e feeds oficiais** são sempre a primeira fonte de dados.
6. **Automação de navegador** é um adaptador de último recurso, específico por loja, limitado e sujeito aos termos de cada plataforma.

O MCP é opcional. Ele pode ser adicionado mais tarde como interface para uma IA pesquisar e comandar a plataforma, mas **não é o motor principal**. O n8n é o motor de execução 24/7.

### Decisão final

Implementar inicialmente um **monorepo privado** com Docker Compose, contendo:

- n8n;
- PostgreSQL;
- Freguesia Worker (API + Playwright);
- Caddy como proxy HTTPS em produção;
- Redis somente quando queue mode ou concorrência distribuída forem necessários;
- workflows n8n exportados e versionados;
- testes unitários, de integração, de contrato e E2E;
- aprovação humana antes da postagem pública durante todo o MVP.

### Regra arquitetural central

> O n8n coordena; o Worker executa a lógica de domínio e a navegação; o PostgreSQL é a fonte de verdade; o Telegram é a interface de aprovação e distribuição.

---

## 2. Visão do produto

### 2.1 Proposta

A Freguesia procura ofertas em fontes cadastradas, extrai e normaliza os dados, avalia se o desconto parece legítimo, cria ou recebe um link de afiliado, apresenta a oferta ao administrador em um canal privado e, após aprovação, publica no canal público.

### 2.2 Resultado esperado de uma postagem

Exemplo:

```text
🔥 OFERTA NA FREGUESIA

Livro Justiça em Mutação

De R$ 79,90 por R$ 49,90
38% de desconto

🛒 Comprar com desconto

Preço e disponibilidade podem mudar a qualquer momento.
Link de afiliado: a Freguesia pode receber comissão pela compra.
```

A mensagem deve incluir:

- imagem principal autorizada;
- título normalizado;
- preço atual;
- preço anterior somente quando verificável;
- percentual calculado pelo sistema, nunca copiado cegamente;
- loja;
- botão com link de afiliado;
- aviso de preço variável;
- disclosure de afiliado;
- timestamp interno da verificação;
- identificador de rastreamento da publicação.

### 2.3 O que o projeto não deve prometer

- Não prometer que todas as lojas serão automatizáveis.
- Não prometer que o Mercado Livre fornecerá uma API pública de afiliados.
- Não contornar captcha, autenticação, rate limit, bloqueio regional ou proteção anti-bot.
- Não fabricar preço anterior.
- Não afirmar “menor preço” sem histórico e comparação suficientes.
- Não baixar, armazenar ou reutilizar imagens além do permitido pelos termos da fonte.
- Não publicar automaticamente em produção antes de validar a fonte.

---

## 3. Descobertas e decisões anteriores

### 3.1 Mercado Livre

Durante a validação, URLs no formato:

```text
https://www.mercadolivre.com.br/.../up/MLBU4123388377
```

apresentaram identificadores `MLBU...`, correspondentes ao modelo User Product/Unified Product. Esses IDs não funcionaram no endpoint público tradicional:

```text
GET https://api.mercadolibre.com/items/{item_id}
```

A página também não entregou metadados suficientes a uma requisição HTTP simples. Isso demonstra que:

- a API de Developers não deve ser tratada como API de descoberta de afiliados;
- páginas `/up/MLBU...` podem exigir renderização no navegador;
- a geração de link afiliado é uma responsabilidade diferente da consulta a itens;
- o adaptador do Mercado Livre será experimental até existir autorização/fonte oficial adequada.

### 3.2 OAuth do Mercado Livre

Foi criado um aplicativo de Developers, com redirect HTTPS temporário via ngrok. A conexão OAuth apresentou comportamento inconsistente e não é necessária para consultar todo dado público. Não tornar essa integração um bloqueador do MVP.

As credenciais criadas anteriormente devem ser tratadas como sensíveis. Um authtoken do ngrok foi exposto durante o processo e deve permanecer revogado. Nunca reutilizar segredos mostrados em conversas, prints ou logs.

### 3.3 Consequência prática

O MVP deve começar com uma combinação de:

- fontes oficiais com API/feed;
- páginas públicas permitidas;
- entrada manual de link afiliado quando não existir conversão oficial por API;
- automação de navegador somente depois de revisão dos termos;
- aprovação humana obrigatória.

---

## 4. Requisitos funcionais

### RF-001 — Cadastro de fontes

O administrador deve poder cadastrar fontes de oferta:

- API oficial;
- feed CSV/XML/JSON;
- RSS;
- página pública;
- portal autenticado;
- entrada manual;
- webhook externo.

Cada fonte deve ter:

- identificador;
- nome;
- tipo;
- loja;
- status ativo/inativo;
- intervalo mínimo de consulta;
- limite por execução;
- política de uso;
- configuração de autenticação referenciada por secret ID;
- adaptador responsável;
- data do último sucesso;
- data e descrição do último erro;
- circuito aberto/fechado;
- prioridade.

### RF-002 — Descoberta de candidatos

O sistema deve executar buscas por:

- categorias;
- palavras-chave;
- listas de produtos monitorados;
- páginas de promoções;
- feeds oficiais;
- produtos enviados manualmente.

### RF-003 — Extração e normalização

Converter resultados heterogêneos para um contrato comum:

```json
{
  "source": "mercado_livre",
  "externalId": "MLBU4123388377",
  "canonicalUrl": "https://...",
  "title": "Livro Justiça em Mutação",
  "currentPriceCents": 4990,
  "previousPriceCents": 7990,
  "currency": "BRL",
  "imageUrl": "https://...",
  "availability": "in_stock",
  "seller": null,
  "rating": null,
  "reviewCount": null,
  "capturedAt": "2026-08-15T18:00:00Z",
  "rawEvidence": {
    "priceSelector": "...",
    "imageSelector": "..."
  }
}
```

### RF-004 — Validação de promoção

O sistema deve:

- rejeitar preço zero ou negativo;
- rejeitar moeda inesperada;
- calcular desconto em backend;
- rejeitar preço anterior menor ou igual ao preço atual;
- limitar descontos absurdos, por exemplo acima de 90%, para revisão manual;
- comparar o preço atual ao histórico interno;
- registrar evidência e timestamp;
- impedir publicação se a captura estiver velha;
- permitir regras por categoria e loja.

### RF-005 — Deduplicação

Detectar duplicação por:

1. `source + external_id`;
2. URL canônica normalizada;
3. GTIN/EAN/ISBN quando disponível;
4. hash de título + marca + modelo;
5. similaridade textual apenas como sinal auxiliar.

Não republicar o mesmo produto antes do `REPOST_COOLDOWN_HOURS`, salvo queda de preço superior ao limite configurado.

### RF-006 — Link afiliado

Estratégias possíveis:

- API oficial de conversão;
- template de tracking permitido;
- feed já com URL afiliada;
- conversão assistida no portal;
- entrada manual.

Todo link deve ser validado quanto a:

- esquema `https`;
- domínio permitido;
- redirecionamentos;
- presença esperada do tracking;
- ausência de credenciais na query string;
- associação à oferta correta.

### RF-007 — Imagem

Prioridade:

1. URL de imagem fornecida por API/feed oficial;
2. URL de imagem autorizada encontrada no DOM;
3. preview automático do Telegram;
4. imagem manual;
5. postagem sem imagem.

Nunca usar screenshot da página como imagem do produto por padrão. Não remover marca d'água nem alterar material proprietário. Não armazenar imagem quando a licença permitir somente hotlink ou cache temporário.

### RF-008 — Aprovação

Toda oferta do MVP deve ir a um chat/canal privado com botões:

- `✅ Aprovar`;
- `✏️ Editar`;
- `❌ Descartar`;
- `🔄 Revalidar`;
- `🕒 Agendar`.

Somente usuários presentes em `TELEGRAM_ADMIN_USER_IDS` podem aprovar.

### RF-009 — Publicação

A publicação deve ser idempotente. Uma oferta não pode gerar duas postagens públicas em caso de retry.

### RF-010 — Histórico e auditoria

Registrar:

- quem aprovou;
- quando aprovou;
- dados antes/depois de edição;
- fonte e evidência;
- preço no momento da coleta;
- preço no momento da publicação;
- ID da mensagem do Telegram;
- status e erro de cada execução;
- versão do adaptador.

### RF-011 — Alertas operacionais

Notificar o administrador quando:

- login expirar;
- captcha aparecer;
- seletor não for encontrado;
- fonte falhar repetidamente;
- preço divergir muito;
- link afiliado não for gerado;
- Telegram rejeitar mídia ou mensagem;
- banco ou Worker ficar indisponível.

---

## 5. Requisitos não funcionais

### RNF-001 — Segurança

- Secrets nunca no Git.
- Secrets nunca em saída de nó, log, screenshot ou mensagem.
- TLS obrigatório em produção.
- API interna protegida por token de serviço.
- Allowlist de domínios para impedir SSRF.
- Menor privilégio para bot e credenciais.
- Sessão Playwright criptografada ou armazenada em volume protegido.
- Backups criptografados.

### RNF-002 — Confiabilidade

- retries com exponential backoff e jitter;
- idempotency keys;
- circuit breaker por fonte;
- timeout por navegação;
- limite de concorrência;
- dead-letter status para análise manual;
- health checks;
- graceful shutdown.

### RNF-003 — Manutenibilidade

- adaptador por loja;
- seletores centralizados;
- domínio independente de Playwright e n8n;
- contratos tipados com Zod;
- funções pequenas e puras quando possível;
- logs estruturados;
- documentação de decisões arquiteturais (ADRs).

### RNF-004 — Performance

Meta inicial:

- até 100 candidatos por hora;
- máximo de 1 navegador simultâneo por fonte sensível;
- resposta do Worker abaixo de 30 s para API/feed;
- navegador com timeout total de 90 s;
- fila de aprovação sem limite crítico, com limpeza configurável.

### RNF-005 — Custo

O MVP deve caber em uma VPS pequena, começando com:

- 2 vCPU;
- 4 GB RAM como mínimo prático para n8n + PostgreSQL + Chromium;
- 8 GB RAM recomendado para maior estabilidade;
- 30–50 GB SSD;
- swap configurado com cautela.

---

## 6. Arquitetura detalhada

```mermaid
flowchart TD
    S[Schedule n8n] --> C[Coletar fontes]
    C --> W[Freguesia Worker]
    W --> B[APIs, feeds ou navegador]
    W --> P[(PostgreSQL)]
    C --> V[Validar e pontuar]
    V --> A[Telegram privado]
    A --> D{Decisão humana}
    D -->|Aprovar| R[Revalidar preço e link]
    D -->|Editar| E[Fluxo de edição]
    D -->|Descartar| X[Arquivar]
    R --> T[Canal público]
    T --> P
```

### 6.1 n8n

Responsabilidades:

- agendamento;
- fan-out/fan-in;
- chamadas ao Worker;
- roteamento por status;
- aprovação via Telegram;
- retries de workflow;
- alertas;
- operação visual.

O n8n **não** deve conter:

- seletores CSS extensos;
- código Playwright;
- regras de domínio duplicadas;
- tokens hardcoded;
- SQL complexo espalhado em Code nodes;
- transformação crítica sem testes.

### 6.2 Freguesia Worker

Responsabilidades:

- adaptadores de fontes;
- navegação Playwright;
- extração;
- canonicalização de URLs;
- cálculo de desconto;
- validação de imagem;
- criação de link afiliado por adaptador;
- persistência transacional;
- idempotência;
- health/readiness;
- logs estruturados.

### 6.3 PostgreSQL

Fonte de verdade. n8n não deve ser usado como banco de negócio.

### 6.4 Redis

Não é obrigatório no primeiro MVP. Adicionar quando:

- n8n usar queue mode;
- houver mais de um worker n8n;
- o Worker precisar de fila distribuída;
- locks em memória não forem suficientes.

### 6.5 Caddy

Proxy reverso recomendado pela simplicidade de HTTPS automático. Em produção:

- somente Caddy expõe portas 80/443;
- n8n, Worker, PostgreSQL e Redis permanecem em rede privada Docker;
- proteger painel n8n por autenticação do próprio n8n e, opcionalmente, allowlist/VPN.

---

## 7. Stack recomendada

| Camada | Tecnologia | Motivo |
| --- | --- | --- |
| Orquestração | n8n self-hosted | Agendamento, integrações, aprovação e operação visual |
| Worker | Node.js + TypeScript | Mesma linguagem de Playwright e forte ecossistema |
| API do Worker | Fastify | Baixo overhead, schemas e boa testabilidade |
| Validação | Zod | Contratos runtime + TypeScript |
| Navegador | Playwright | Automação moderna e contextos isolados |
| Banco | PostgreSQL | Consistência, índices, JSONB e auditoria |
| ORM/migrations | Prisma ou Drizzle | Escolher um; não misturar |
| Logs | Pino | JSON estruturado e integração com Fastify |
| Testes | Vitest + Playwright Test | Unitário/integração/E2E |
| Telegram | nó oficial n8n ou Bot API HTTP | Evitar bot framework extra no MVP |
| Proxy | Caddy | TLS automático e configuração pequena |
| Containers | Docker Compose | Desenvolvimento e VPS simples |
| CI | GitHub Actions | lint, testes, build, auditoria |
| Formatação | Prettier + ESLint | padrão automático |
| Commits | Conventional Commits | changelog e histórico claro |

### 7.1 Browserless

Browserless é opcional. Não é a recomendação inicial porque:

- adiciona custo/licença para uso comercial proprietário;
- o Worker pode executar Playwright diretamente;
- uma dependência a menos facilita o MVP.

Adotar Browserless somente se for necessário separar e escalar browsers. Revisar a licença antes do uso comercial.

---

## 8. Repositórios e documentação de referência

### Obrigatórios ou recomendados

- n8n: <https://github.com/n8n-io/n8n>
- exemplos oficiais de hosting n8n: <https://github.com/n8n-io/n8n-hosting>
- documentação n8n: <https://docs.n8n.io/>
- Playwright: <https://github.com/microsoft/playwright>
- documentação Playwright: <https://playwright.dev/docs/intro>
- Telegram Bot API: <https://core.telegram.org/bots/api>
- PostgreSQL: <https://www.postgresql.org/docs/>
- Docker Compose: <https://docs.docker.com/compose/>
- Caddy: <https://github.com/caddyserver/caddy>
- Zod: <https://github.com/colinhacks/zod>
- Fastify: <https://github.com/fastify/fastify>
- Vitest: <https://github.com/vitest-dev/vitest>
- Pino: <https://github.com/pinojs/pino>

### Opcionais

- Browserless: <https://github.com/browserless/browserless>
- Playwright MCP: <https://github.com/microsoft/playwright-mcp>
- n8n nodes starter: <https://github.com/n8n-io/n8n-nodes-starter>
- Renovate: <https://github.com/renovatebot/renovate>

### Política de dependências

- Não clonar/forkar n8n nem Playwright para construir a Freguesia.
- Usar imagens e pacotes oficiais.
- Fixar versões em produção; não usar `latest`.
- O pacote Playwright e a imagem/container com browsers devem ter versões compatíveis.
- Fazer atualização em PR separado, com changelog e testes.
- Usar Renovate ou Dependabot com agrupamento controlado.

---

## 9. Estrutura do repositório

```text
freguesia/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── security.yml
│   │   └── docker-build.yml
│   ├── dependabot.yml
│   └── pull_request_template.md
├── apps/
│   └── worker/
│       ├── src/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── config/
│       │   │   ├── env.ts
│       │   │   └── logger.ts
│       │   ├── domain/
│       │   │   ├── offer.ts
│       │   │   ├── price.ts
│       │   │   ├── affiliate-link.ts
│       │   │   └── source.ts
│       │   ├── application/
│       │   │   ├── discover-offers.ts
│       │   │   ├── validate-offer.ts
│       │   │   ├── approve-offer.ts
│       │   │   ├── revalidate-offer.ts
│       │   │   └── publish-offer.ts
│       │   ├── adapters/
│       │   │   ├── sources/
│       │   │   │   ├── source-adapter.ts
│       │   │   │   ├── manual.adapter.ts
│       │   │   │   ├── feed.adapter.ts
│       │   │   │   ├── amazon.adapter.ts
│       │   │   │   └── mercadolivre.experimental.adapter.ts
│       │   │   ├── browser/
│       │   │   │   ├── browser-pool.ts
│       │   │   │   ├── session-store.ts
│       │   │   │   └── captcha-detector.ts
│       │   │   ├── persistence/
│       │   │   ├── telegram/
│       │   │   └── affiliate/
│       │   ├── http/
│       │   │   ├── routes/
│       │   │   ├── schemas/
│       │   │   └── middleware/
│       │   └── shared/
│       │       ├── errors.ts
│       │       ├── result.ts
│       │       └── url.ts
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   ├── contract/
│       │   ├── e2e/
│       │   └── fixtures/
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── packages/
│   ├── contracts/
│   └── eslint-config/
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema.sql
├── n8n/
│   ├── workflows/
│   │   ├── 001-discover-offers.json
│   │   ├── 002-request-approval.json
│   │   ├── 003-handle-telegram-callback.json
│   │   ├── 004-publish-offer.json
│   │   ├── 005-monitor-health.json
│   │   └── 006-cleanup.json
│   ├── credentials/README.md
│   └── README.md
├── infra/
│   ├── compose.yaml
│   ├── compose.override.yaml
│   ├── Caddyfile
│   └── backup/
├── docs/
│   ├── adr/
│   ├── runbooks/
│   ├── sources/
│   ├── SECURITY.md
│   └── DATA_RETENTION.md
├── scripts/
│   ├── export-n8n-workflows.sh
│   ├── import-n8n-workflows.sh
│   ├── backup.sh
│   └── restore.sh
├── .dockerignore
├── .editorconfig
├── .env.example
├── .gitignore
├── compose.yaml
├── LICENSE
├── README.md
└── SECURITY.md
```

---

## 10. Variáveis de ambiente — catálogo completo

### 10.1 Regras

- `.env.example` contém nomes e valores não secretos.
- `.env` nunca entra no Git.
- Produção deve preferir secrets do Docker, secret manager ou variáveis protegidas.
- Toda variável é validada na inicialização com Zod.
- O processo falha rápido se variável obrigatória estiver ausente.
- Nunca imprimir valores secretos nos logs.

### 10.2 Identidade e ambiente

```dotenv
APP_NAME=Freguesia
APP_ENV=development
APP_VERSION=0.1.0
NODE_ENV=development
TZ=America/Sao_Paulo
LOG_LEVEL=info
LOG_PRETTY=true
```

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `APP_NAME` | sim | Nome nos logs e métricas |
| `APP_ENV` | sim | `development`, `test`, `staging`, `production` |
| `APP_VERSION` | sim em produção | versão ou SHA |
| `NODE_ENV` | sim | comportamento Node |
| `TZ` | sim | timezone operacional |
| `LOG_LEVEL` | sim | `debug`, `info`, `warn`, `error` |
| `LOG_PRETTY` | não | somente desenvolvimento |

### 10.3 Worker HTTP

```dotenv
WORKER_HOST=0.0.0.0
WORKER_PORT=3001
WORKER_PUBLIC_BASE_URL=https://worker.example.com
WORKER_INTERNAL_BASE_URL=http://worker:3001
WORKER_SERVICE_TOKEN=generate-a-long-random-secret
WORKER_REQUEST_TIMEOUT_MS=120000
WORKER_BODY_LIMIT_BYTES=1048576
WORKER_ALLOWED_ORIGINS=https://n8n.example.com
```

`WORKER_SERVICE_TOKEN` autentica n8n → Worker. Usar no header:

```http
Authorization: Bearer <token>
```

### 10.4 PostgreSQL

```dotenv
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=freguesia
POSTGRES_USER=freguesia
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql://freguesia:change-me@postgres:5432/freguesia?schema=public
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_STATEMENT_TIMEOUT_MS=15000
```

Em produção, não duplicar senha manualmente em múltiplos lugares; gerar `DATABASE_URL` no secret manager ou entrypoint controlado.

### 10.5 n8n

```dotenv
N8N_IMAGE_VERSION=2.30.5
N8N_HOST=n8n.example.com
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_EDITOR_BASE_URL=https://n8n.example.com
WEBHOOK_URL=https://n8n.example.com/
N8N_ENCRYPTION_KEY=generate-at-least-32-random-bytes
GENERIC_TIMEZONE=America/Sao_Paulo
TZ=America/Sao_Paulo
N8N_DIAGNOSTICS_ENABLED=false
N8N_PERSONALIZATION_ENABLED=false
N8N_HIRING_BANNER_ENABLED=false
N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
N8N_LOG_LEVEL=info
N8N_LOG_OUTPUT=console
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=336
N8N_DEFAULT_BINARY_DATA_MODE=filesystem
N8N_BINARY_DATA_STORAGE_PATH=/home/node/.n8n/binaryData
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=change-me
```

Notas:

- `N8N_ENCRYPTION_KEY` deve ser estável; perdê-la pode impedir descriptografar credenciais.
- A versão `2.30.5` é uma referência identificada em agosto de 2026; antes de implementar, confirmar release estável e fixar a versão testada.
- Não usar `latest`.
- Ajustar retenção conforme privacidade e espaço.
- Em produção, executar o security audit do n8n.

### 10.6 Redis e queue mode — somente fase de escala

```dotenv
EXECUTIONS_MODE=queue
QUEUE_BULL_REDIS_HOST=redis
QUEUE_BULL_REDIS_PORT=6379
QUEUE_BULL_REDIS_PASSWORD=change-me
QUEUE_BULL_REDIS_DB=0
N8N_CONCURRENCY_PRODUCTION_LIMIT=5
```

No MVP de uma única instância, omitir queue mode para reduzir complexidade.

### 10.7 Playwright

```dotenv
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_NAVIGATION_TIMEOUT_MS=45000
PLAYWRIGHT_ACTION_TIMEOUT_MS=15000
PLAYWRIGHT_JOB_TIMEOUT_MS=90000
PLAYWRIGHT_MAX_CONCURRENCY=1
PLAYWRIGHT_LOCALE=pt-BR
PLAYWRIGHT_TIMEZONE_ID=America/Sao_Paulo
PLAYWRIGHT_AUTH_DIR=/app/data/auth
PLAYWRIGHT_SCREENSHOT_DIR=/app/data/screenshots
PLAYWRIGHT_TRACE_DIR=/app/data/traces
PLAYWRIGHT_CAPTURE_TRACE_ON_ERROR=true
PLAYWRIGHT_CAPTURE_SCREENSHOT_ON_ERROR=true
PLAYWRIGHT_SESSION_ENCRYPTION_KEY=generate-32-byte-key
```

Não configurar fingerprint falsificado, captcha solver ou mecanismos de evasão.

### 10.8 Telegram

```dotenv
TELEGRAM_BOT_TOKEN=secret-from-botfather
TELEGRAM_APPROVAL_CHAT_ID=-1000000000001
TELEGRAM_PUBLIC_CHANNEL_ID=-1000000000002
TELEGRAM_PUBLIC_CHANNEL_USERNAME=@freguesia
TELEGRAM_ADMIN_USER_IDS=123456789,987654321
TELEGRAM_WEBHOOK_SECRET=generate-long-random-secret
TELEGRAM_PARSE_MODE=HTML
TELEGRAM_DISABLE_NOTIFICATION=false
TELEGRAM_PROTECT_CONTENT=false
TELEGRAM_MESSAGE_FOOTER=Preço sujeito a alteração. Link de afiliado.
TELEGRAM_MAX_CAPTION_LENGTH=1024
```

O bot deve ter somente:

- permissão para publicar no canal público;
- permissão necessária no chat de aprovação;
- nenhuma permissão administrativa desnecessária.

### 10.9 Regras de oferta

```dotenv
DEFAULT_CURRENCY=BRL
MIN_DISCOUNT_PERCENT=20
MAX_AUTOMATIC_DISCOUNT_PERCENT=80
MIN_PRICE_CENTS=100
MAX_PRICE_CENTS=5000000
MAX_OFFER_AGE_MINUTES=30
REVALIDATE_BEFORE_PUBLISH=true
REPOST_COOLDOWN_HOURS=168
REPOST_MIN_PRICE_DROP_PERCENT=10
MAX_OFFERS_PER_RUN=25
MAX_PUBLICATIONS_PER_HOUR=6
MAX_PUBLICATIONS_PER_DAY=40
PUBLICATION_MIN_INTERVAL_SECONDS=600
REQUIRE_HUMAN_APPROVAL=true
```

### 10.10 Fontes e navegador

```dotenv
SOURCE_MANUAL_ENABLED=true
SOURCE_FEEDS_ENABLED=true
SOURCE_AMAZON_ENABLED=false
SOURCE_MERCADOLIVRE_ENABLED=false
SOURCE_MERCADOLIVRE_MODE=experimental_browser
SOURCE_MERCADOLIVRE_BASE_URL=https://www.mercadolivre.com.br
SOURCE_MERCADOLIVRE_ALLOWED_DOMAINS=mercadolivre.com.br,www.mercadolivre.com.br,produto.mercadolivre.com.br
SOURCE_MERCADOLIVRE_MIN_INTERVAL_MS=5000
SOURCE_MERCADOLIVRE_MAX_PAGES_PER_RUN=3
SOURCE_MERCADOLIVRE_SESSION_PATH=/app/data/auth/mercadolivre.json
SOURCE_MERCADOLIVRE_REQUIRE_TERMS_APPROVAL=true
```

### 10.11 Afiliados

```dotenv
AFFILIATE_DISCLOSURE_TEXT=A Freguesia pode receber comissão por compras realizadas pelo link.
AFFILIATE_LINK_TIMEOUT_MS=30000
AFFILIATE_MAX_REDIRECTS=5
AFFILIATE_REQUIRE_HTTPS=true
AFFILIATE_ALLOWED_DOMAINS=mercadolivre.com.br,amzn.to,amazon.com.br
MERCADOLIVRE_AFFILIATE_MODE=manual
AMAZON_ASSOCIATE_TAG=
AMAZON_ACCESS_KEY=
AMAZON_SECRET_KEY=
AMAZON_PARTNER_TYPE=Associates
AMAZON_MARKETPLACE=www.amazon.com.br
```

Credenciais Amazon devem permanecer vazias até aprovação formal e leitura dos termos aplicáveis.

### 10.12 Imagem

```dotenv
IMAGE_MAX_BYTES=5242880
IMAGE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp
IMAGE_DOWNLOAD_TIMEOUT_MS=15000
IMAGE_CACHE_TTL_HOURS=1
IMAGE_HOTLINK_ALLOWED_BY_DEFAULT=false
IMAGE_FALLBACK_TO_TELEGRAM_PREVIEW=true
IMAGE_REQUIRE_LICENSE_POLICY=true
```

### 10.13 Retry, circuit breaker e alertas

```dotenv
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY_MS=1000
RETRY_MAX_DELAY_MS=30000
RETRY_JITTER=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT_SECONDS=900
ALERT_TELEGRAM_CHAT_ID=-1000000000001
ALERT_ON_SOURCE_FAILURE=true
ALERT_ON_CAPTCHA=true
ALERT_ON_SESSION_EXPIRED=true
ALERT_ON_PUBLICATION_FAILURE=true
```

### 10.14 Observabilidade

```dotenv
METRICS_ENABLED=true
METRICS_PORT=9090
HEALTHCHECK_PATH=/health
READINESS_PATH=/ready
OTEL_ENABLED=false
OTEL_SERVICE_NAME=freguesia-worker
OTEL_EXPORTER_OTLP_ENDPOINT=
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.0
```

---

## 11. Modelo de dados

### 11.1 Entidades

#### `sources`

```sql
CREATE TABLE sources (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  store TEXT NOT NULL,
  type TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  priority INTEGER NOT NULL DEFAULT 100,
  config JSONB NOT NULL DEFAULT '{}',
  terms_reviewed_at TIMESTAMPTZ,
  terms_reviewed_by TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error_code TEXT,
  circuit_state TEXT NOT NULL DEFAULT 'closed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `products`

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES sources(id),
  external_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  gtin TEXT,
  category TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  image_url TEXT,
  availability TEXT NOT NULL DEFAULT 'unknown',
  metadata JSONB NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, external_id)
);
```

#### `price_observations`

```sql
CREATE TABLE price_observations (
  id BIGSERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  current_price_cents BIGINT NOT NULL CHECK (current_price_cents > 0),
  previous_price_cents BIGINT,
  currency CHAR(3) NOT NULL,
  availability TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}',
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_observations_product_time
ON price_observations(product_id, captured_at DESC);
```

#### `offers`

```sql
CREATE TABLE offers (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  source_observation_id BIGINT NOT NULL REFERENCES price_observations(id),
  status TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2),
  affiliate_url TEXT,
  affiliate_provider TEXT,
  image_url TEXT,
  proposed_caption TEXT,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Status permitidos:

```text
discovered
validated
needs_affiliate_link
pending_approval
approved
rejected
scheduled
publishing
published
expired
failed
blocked_captcha
blocked_terms
```

#### `approvals`

```sql
CREATE TABLE approvals (
  id UUID PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES offers(id),
  decision TEXT NOT NULL,
  actor_telegram_user_id BIGINT NOT NULL,
  actor_username TEXT,
  notes TEXT,
  payload_before JSONB NOT NULL,
  payload_after JSONB,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `publications`

```sql
CREATE TABLE publications (
  id UUID PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES offers(id),
  channel_id TEXT NOT NULL,
  telegram_message_id BIGINT,
  final_caption TEXT NOT NULL,
  final_image_url TEXT,
  final_affiliate_url TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  published_at TIMESTAMPTZ,
  error_code TEXT,
  error_detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `workflow_events`

Guardar eventos append-only para auditoria:

```sql
CREATE TABLE workflow_events (
  id BIGSERIAL PRIMARY KEY,
  correlation_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 11.2 Valores monetários

- Sempre armazenar centavos em inteiros.
- Nunca usar float para dinheiro.
- Usar currency ISO 4217.
- Formatar BRL somente na borda de apresentação.

---

## 12. Contratos da API interna

### Autenticação

Todas as rotas, exceto health/readiness, exigem Bearer token.

### `GET /health`

Retorna processo vivo, sem testar dependências.

### `GET /ready`

Testa banco, diretório de sessão e browser launcher.

### `POST /v1/discovery-runs`

```json
{
  "sourceSlug": "mercadolivre-experimental",
  "query": "livros",
  "category": "books",
  "limit": 20,
  "correlationId": "uuid"
}
```

Resposta `202 Accepted`:

```json
{
  "runId": "uuid",
  "status": "accepted"
}
```

### `GET /v1/discovery-runs/{runId}`

Retorna progresso e IDs das ofertas.

### `POST /v1/offers/{offerId}/revalidate`

Reabre a fonte e confirma preço, disponibilidade, imagem e link.

### `POST /v1/offers/{offerId}/affiliate-link`

Pode retornar:

- `generated`;
- `manual_required`;
- `session_expired`;
- `captcha_required`;
- `unsupported`.

### `POST /v1/offers/{offerId}/approve`

Exige ator e idempotency key.

### `POST /v1/offers/{offerId}/publish`

Não publica diretamente no Telegram se o n8n for o dono da publicação. Nesse desenho, retorna o payload final já validado para o n8n enviar.

### `POST /v1/telegram/callback`

Opcional se callbacks forem recebidos pelo Worker. Recomendação inicial: receber no n8n, validar admin e chamar Worker.

### Formato de erro

```json
{
  "error": {
    "code": "SOURCE_CAPTCHA_REQUIRED",
    "message": "Intervenção humana necessária",
    "retryable": false,
    "correlationId": "uuid",
    "details": {}
  }
}
```

Nunca incluir cookies, tokens, HTML completo ou stack trace em produção.

---

## 13. Workflows n8n

### 13.1 WF-001 — Descobrir ofertas

Nós:

1. `Schedule Trigger`.
2. `Postgres/Get enabled sources` ou HTTP Worker.
3. `Loop Over Items` com concorrência limitada.
4. `HTTP Request /v1/discovery-runs`.
5. `Wait/Poll` até concluir.
6. `Filter` para candidatos validados.
7. `Execute Sub-workflow: Request Approval`.
8. `Error branch` para alertas.

Regras:

- cron em `America/Sao_Paulo`;
- não sobrepor execução da mesma fonte;
- usar correlation ID;
- limite diário;
- fonte com circuito aberto é ignorada.

### 13.2 WF-002 — Solicitar aprovação

1. Recebe `offerId`.
2. Busca payload final no Worker.
3. Envia `sendPhoto` ao chat privado; se falhar, envia texto com link preview.
4. Inclui inline keyboard.
5. Salva `telegram_message_id`.

`callback_data` deve ser curta e não conter segredo:

```text
offer:approve:<short-id>
offer:reject:<short-id>
offer:revalidate:<short-id>
```

### 13.3 WF-003 — Callback do Telegram

1. `Telegram Trigger` ou Webhook.
2. Validar `TELEGRAM_WEBHOOK_SECRET` quando aplicável.
3. Extrair `from.id`.
4. Verificar allowlist de admins.
5. Parsear callback com schema estrito.
6. Chamar Worker com idempotency key baseada em `update_id`.
7. Responder callback rapidamente para remover loading.
8. Editar mensagem de aprovação com status.
9. Se aprovado, iniciar WF-004.

### 13.4 WF-004 — Publicar oferta

1. Revalidar oferta imediatamente.
2. Se preço mudou além da tolerância, retornar para aprovação.
3. Se indisponível, expirar.
4. Confirmar link afiliado.
5. Gerar legenda final.
6. Reservar idempotência no banco.
7. Publicar no canal.
8. Salvar message ID e timestamp.
9. Marcar `published`.

### 13.5 WF-005 — Monitoramento

A cada 5 minutos:

- `GET worker/health`;
- `GET worker/ready`;
- consulta de último sucesso por fonte;
- checagem de fila parada;
- alerta consolidado, evitando spam.

### 13.6 WF-006 — Limpeza

Diariamente:

- expirar ofertas antigas;
- limpar traces/screenshots fora da retenção;
- podar execuções n8n;
- remover cache de imagem vencido;
- compactar métricas se necessário;
- nunca apagar auditoria sem política aprovada.

### 13.7 Exportação dos workflows

Workflows devem ser exportados para JSON e versionados. Credenciais não devem acompanhar exportação. Toda mudança visual relevante deve estar em PR com:

- workflow JSON;
- screenshot opcional;
- descrição dos nós alterados;
- teste manual documentado;
- plano de rollback.

---

## 14. Estratégia Playwright

### 14.1 Sessão autenticada

Usar `storageState` para cookies e localStorage. A documentação do Playwright alerta que o arquivo pode permitir impersonação. Portanto:

- diretório `.auth` no `.gitignore`;
- volume protegido;
- permissões de arquivo restritas;
- criptografia em repouso quando possível;
- conta dedicada ao projeto;
- nunca enviar arquivo de sessão à IA;
- renovar sessão por login manual;
- excluir sessão ao revogar acesso.

### 14.2 Login assistido

Criar comando separado:

```text
npm run auth:mercadolivre
```

O comando abre browser headed, o administrador faz login manualmente e o processo salva `storageState`. Não automatizar senha, MFA ou captcha.

### 14.3 Adaptador por fonte

Interface:

```ts
export interface SourceAdapter {
  readonly source: SourceId;
  discover(input: DiscoveryInput): Promise<DiscoveredProduct[]>;
  extract(url: URL): Promise<ExtractedProduct>;
  revalidate(product: ProductRef): Promise<PriceSnapshot>;
  createAffiliateLink?(url: URL): Promise<AffiliateLinkResult>;
  healthCheck(): Promise<AdapterHealth>;
}
```

### 14.4 Seletores

Prioridade:

1. atributos semânticos e acessibilidade;
2. JSON-LD;
3. dados de rede permitidos e documentados;
4. atributos estáveis (`data-*`);
5. CSS estrutural como último recurso.

Não usar classes geradas/minificadas sem fallback.

### 14.5 Detecção de bloqueio

Se a página contiver sinais de:

- captcha;
- “verifique que você é humano”;
- login expirado;
- acesso negado;
- rate limit;
- consentimento novo;

o adaptador retorna erro tipado e interrompe. Não tentar contornar.

### 14.6 Evidência de erro

Em falha:

- screenshot redigida;
- trace Playwright com retenção curta;
- URL sem query sensível;
- nome do seletor que falhou;
- versão do adaptador;
- correlation ID.

---

## 15. Mercado Livre — política específica

### 15.1 Estado

Marcar adaptador como `experimental` e desabilitado por padrão.

### 15.2 Antes de ativar

1. Ler os termos atuais do Programa de Afiliados.
2. Confirmar se automação do Portal do Afiliado é permitida.
3. Registrar a data e a versão/link dos termos.
4. Confirmar regras de uso de imagem e preço.
5. Definir limite de navegação conservador.
6. Testar somente com conta dedicada e canal privado.

### 15.3 Link afiliado

Modo inicial recomendado:

```dotenv
MERCADOLIVRE_AFFILIATE_MODE=manual
```

O bot encontra/prepara a oferta, mas aguarda link comissionado inserido pelo administrador. Automatizar o gerador somente se autorizado e estável.

### 15.4 URLs `/up/MLBU...`

Não enviar `MLBU...` ao endpoint `/items/`. Tratar como uma página unificada renderizada. Não assumir correspondência 1:1 com anúncio de vendedor.

---

## 16. Telegram

### 16.1 Configuração

1. Criar bot no `@BotFather`.
2. Criar canal privado de aprovação.
3. Criar canal público.
4. Adicionar bot como administrador com menor privilégio.
5. Descobrir IDs sem expor token.
6. Salvar token no gerenciador de credenciais do n8n.

### 16.2 Webhook vs polling

Produção: webhook HTTPS. Desenvolvimento local: polling ou tunnel temporário.

O Telegram define webhooks e `getUpdates` como mutuamente exclusivos. Não ativar ambos ao mesmo tempo.

### 16.3 Publicação de imagem

Tentar `sendPhoto` com URL autorizada. Se o Telegram não conseguir buscar:

1. baixar temporariamente se permitido;
2. validar mime/size;
3. enviar arquivo;
4. apagar cache no prazo;
5. se não permitido, usar `sendMessage` com preview.

### 16.4 Segurança da aprovação

- Validar `from.id`, não username.
- Uma aprovação só vale uma vez.
- Callback expirado deve ser rejeitado.
- Oferta editada após aprovação exige nova aprovação.
- Atualizar botão/status para impedir duplo clique.

---

## 17. Pontuação e regras de curadoria

Exemplo de score 0–100:

| Critério | Peso |
| --- | ---: |
| Desconto verificado | 0–35 |
| Preço abaixo da mediana histórica | 0–20 |
| Confiabilidade da fonte | 0–15 |
| Disponibilidade | 0–10 |
| Avaliação e quantidade de reviews | 0–10 |
| Adequação ao nicho | 0–10 |

Penalidades:

- preço anterior sem evidência: `-25`;
- título incompleto: `-10`;
- imagem ausente: `-10`;
- fonte experimental: `-15`;
- oferta repetida: rejeição ou `-50`;
- desconto acima de 80%: revisão obrigatória.

O score nunca deve substituir validações duras.

---

## 18. Idempotência e concorrência

### Idempotency keys

Descoberta:

```text
sha256(source + externalId + currentPriceCents + capturedHour)
```

Publicação:

```text
sha256(offerId + channelId + approvedRevision)
```

### Locks

- lock por fonte durante discovery;
- lock por oferta durante aprovação/publicação;
- unique constraints no banco são a barreira final;
- não confiar somente no n8n para impedir duplicação.

---

## 19. Segurança

### 19.1 Threat model mínimo

Ameaças:

- vazamento do Telegram token;
- roubo de sessão Playwright;
- SSRF por URL de produto maliciosa;
- injeção HTML na legenda;
- callback falso de aprovação;
- publicação duplicada;
- dependência comprometida;
- n8n exposto sem proteção;
- logs com segredo;
- prompt injection em conteúdo de página se IA for adicionada.

### 19.2 Controles

- allowlist estrita de domínios;
- resolver DNS e bloquear IPs privados/loopback para URLs externas;
- limitar redirecionamentos e validar cada destino;
- sanitizar HTML do Telegram;
- nunca executar JavaScript vindo da página fora do browser sandbox;
- token de serviço rotacionável;
- webhook secret;
- admin IDs;
- volumes sem exposição pública;
- non-root containers;
- filesystem read-only onde possível;
- `no-new-privileges`;
- health endpoints sem dados sensíveis;
- backups testados;
- auditoria n8n periódica;
- SCA/SAST em CI.

### 19.3 Prompt injection

Se uma IA for usada para resumir título ou escrever legenda:

- conteúdo da página é dado não confiável;
- a IA não recebe tokens;
- a IA não pode publicar diretamente;
- saída deve seguir JSON Schema;
- domínio valida novamente preços e URLs;
- instruções presentes em páginas devem ser ignoradas;
- publicação continua exigindo aprovação.

---

## 20. Clean Code e padrões

### Princípios

- nomes expressivos em inglês no código; interface com usuário em português;
- uma responsabilidade por módulo;
- domínio não importa Playwright, Fastify ou n8n;
- usar dependency inversion para adaptadores;
- evitar utilitários genéricos sem dono;
- não usar booleanos ambíguos; preferir enums;
- erros tipados com código estável;
- evitar comentários explicando código ruim; comentar decisões e restrições;
- funções preferencialmente abaixo de 30 linhas, sem dogmatismo;
- complexidade ciclomática controlada;
- no máximo três níveis de indentação na lógica principal;
- não usar `any` sem justificativa explícita;
- `strict: true` no TypeScript;
- toda entrada externa passa por schema.

### Exemplo de separação

Ruim:

```ts
async function scrapeAndPost(url: string) {
  // abre navegador, calcula preço, salva banco e publica
}
```

Bom:

```ts
const extracted = await sourceAdapter.extract(url);
const offer = validateOffer(extracted, policy);
await offerRepository.save(offer);
await approvalGateway.request(offer);
```

### Result pattern

Para falhas esperadas de adaptadores, preferir resultado tipado a exceptions genéricas. Exceptions continuam adequadas para falhas inesperadas.

---

## 21. Testes

### 21.1 Pirâmide

- muitos testes unitários de domínio;
- testes de integração de banco/API;
- testes de contrato por adaptador;
- poucos E2E reais.

### 21.2 Unitários obrigatórios

- cálculo de desconto;
- money parsing `1.234,56`;
- normalização de URL;
- allowlist/SSRF;
- deduplicação;
- score;
- idempotency key;
- sanitização de legenda;
- transições de status;
- regras de repost.

### 21.3 Contract tests

Cada fonte deve ter fixtures HTML/JSON versionadas, sem dados pessoais. Testar seletores contra fixtures. Quando a página mudar, atualizar fixture em PR e explicar a mudança.

### 21.4 E2E

- usar ambiente de teste e canal privado;
- não rodar scraping real em todo commit;
- E2E externo agendado e limitado;
- nunca realizar compra;
- nunca clicar em ações irreversíveis;
- respeitar rate limits.

### 21.5 Teste dos workflows n8n

Testar:

- aprovação válida;
- admin inválido;
- callback duplicado;
- imagem indisponível;
- preço alterado antes de publicar;
- timeout do Worker;
- retry sem duplicação;
- alerta consolidado.

---

## 22. Revisão de código

### Checklist de PR

#### Arquitetura

- A regra pertence ao domínio ou está perdida no workflow?
- Foi criada dependência desnecessária?
- O adaptador está isolado?

#### Segurança

- Há segredo, cookie, token ou ID pessoal em código/fixture/log?
- Toda URL externa é validada?
- Há risco de SSRF/open redirect?
- O browser state está ignorado pelo Git?
- A mudança aumenta permissões?

#### Dados

- Migração é reversível ou possui plano de rollback?
- Índices suportam a consulta?
- Dinheiro usa inteiro?
- Idempotência está preservada?

#### Qualidade

- Testes cobrem sucesso e falha?
- Erros são tipados?
- Logs têm correlation ID?
- O nome explica a intenção?
- Há código morto ou duplicado?

#### n8n

- Workflow exportado?
- Credenciais removidas?
- Timeout/retry definidos?
- Caminho de erro existe?
- Execução é idempotente?

### Política de aprovação

- Pelo menos uma revisão humana/IA independente.
- IA pode revisar, mas não aprovar mudanças de segurança sozinha.
- Mudanças em afiliados, login ou publicação requerem teste manual documentado.

---

## 23. Git e CI/CD

### Branches

- `main`: produção;
- branches curtas: `feat/...`, `fix/...`, `chore/...`;
- evitar branch longa `develop` no MVP, a menos que haja staging formal.

### Commits

```text
feat(worker): add manual offer adapter
fix(telegram): prevent duplicate approval callbacks
chore(deps): update playwright to tested version
```

### GitHub Actions

Pipeline mínimo:

1. install com lockfile;
2. lint;
3. format check;
4. typecheck;
5. unit tests;
6. integration tests com PostgreSQL service;
7. build;
8. container scan;
9. dependency audit;
10. validar compose;
11. validar JSON dos workflows.

### Deploy

- construir imagem imutável com tag SHA;
- backup antes de migration;
- aplicar migration como job único;
- subir Worker;
- checar readiness;
- importar/ativar workflows quando necessário;
- smoke test no canal privado;
- rollback por tag anterior.

---

## 24. Docker Compose — desenho recomendado

Serviços iniciais:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U freguesia"]
      interval: 10s
      timeout: 5s
      retries: 5

  n8n:
    image: docker.n8n.io/n8nio/n8n:${N8N_IMAGE_VERSION}
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - n8n_data:/home/node/.n8n
    networks: [internal]

  worker:
    build:
      context: ./apps/worker
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - browser_auth:/app/data/auth
      - worker_traces:/app/data/traces
    networks: [internal]
    security_opt:
      - no-new-privileges:true

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [internal]

networks:
  internal:

volumes:
  postgres_data:
  n8n_data:
  browser_auth:
  worker_traces:
  caddy_data:
  caddy_config:
```

Este trecho é ilustrativo. A implementação deve:

- separar bancos/usuários n8n e Freguesia;
- usar secrets;
- incluir env files corretos;
- adicionar read-only filesystem onde compatível;
- validar requisitos sandbox do Chromium;
- não expor PostgreSQL/Worker publicamente.

---

## 25. Observabilidade e operação

### Logs

Campos obrigatórios:

```json
{
  "level": "info",
  "service": "freguesia-worker",
  "correlationId": "uuid",
  "source": "mercadolivre",
  "offerId": "uuid",
  "event": "offer.revalidated",
  "durationMs": 1823
}
```

Redigir:

- cookies;
- Authorization;
- bot token;
- client secret;
- query params sensíveis;
- HTML bruto;
- dados pessoais.

### Métricas

- `offers_discovered_total`;
- `offers_validated_total`;
- `offers_rejected_total{reason}`;
- `offers_published_total`;
- `source_requests_total{source,status}`;
- `source_duration_seconds`;
- `browser_captcha_total{source}`;
- `affiliate_link_failures_total{source}`;
- `telegram_publish_failures_total`;
- `approval_latency_seconds`;
- `price_revalidation_changes_total`.

### SLO inicial

- 95% das fontes oficiais executam sem erro por dia;
- 99% das ofertas aprovadas são publicadas uma única vez;
- alerta crítico em até 10 minutos;
- zero segredo em logs;
- zero postagem sem aprovação no MVP.

---

## 26. Backups e recuperação

Backup diário de:

- bancos PostgreSQL;
- volume n8n;
- workflows exportados;
- configurações não secretas;
- sessão autenticada somente se a política permitir e com criptografia.

Não depender somente do volume Docker.

### Teste de restore

Mensalmente:

1. criar ambiente isolado;
2. restaurar PostgreSQL;
3. restaurar n8n;
4. confirmar credenciais com a mesma encryption key;
5. rodar smoke test sem publicar no canal público;
6. documentar RTO/RPO observado.

---

## 27. Roadmap

### Fase 0 — Governança

- revisar termos das fontes;
- criar repositório privado;
- definir domínio e VPS;
- revogar segredos expostos;
- criar bot/canais de teste;
- registrar decisões em ADR.

### Fase 1 — MVP manual assistido

- n8n + PostgreSQL + Worker;
- endpoint para cadastrar oferta por URL/dados;
- aprovação Telegram;
- publicação idempotente;
- histórico;
- sem scraping automático.

Critério de saída: 20 ofertas de teste publicadas sem duplicação.

### Fase 2 — Fonte oficial

- integrar um feed/API autorizado;
- descoberta automática;
- imagem oficial;
- score e histórico de preço;
- aprovação humana.

Critério: 7 dias de execução estável.

### Fase 3 — Mercado Livre experimental

- autorização formal/política revisada;
- login assistido;
- Playwright adapter;
- detecção de captcha;
- link manual inicialmente;
- canal privado somente.

Critério: 50 extrações com taxa de sucesso documentada e nenhum bloqueio.

### Fase 4 — Geração afiliada assistida

- automatizar somente se permitido;
- circuit breaker;
- revalidação;
- auditoria completa.

### Fase 5 — Escala

- Redis/queue mode;
- múltiplos workers;
- métricas e dashboards;
- staging separado;
- backups automatizados;
- rotação de secrets.

### Fase 6 — MCP opcional

Expor ferramentas de alto nível:

- `search_offers`;
- `get_offer`;
- `request_approval`;
- `list_source_health`.

O MCP não recebe credenciais e não publica sem aprovação.

---

## 28. Definition of Done

Uma feature só está pronta quando:

- requisitos estão atendidos;
- contratos foram validados;
- testes passam;
- lint/typecheck passam;
- logs e métricas existem;
- falhas possuem tratamento;
- documentação foi atualizada;
- nenhum segredo foi incluído;
- migration e rollback foram considerados;
- workflow foi exportado;
- teste em canal privado foi realizado;
- revisão de código foi concluída;
- termos da fonte continuam válidos.

---

## 29. Instruções para outra IA implementar

### Ordem obrigatória

1. Ler este documento integralmente.
2. Não começar pelo scraper do Mercado Livre.
3. Criar o monorepo e arquivos de governança.
4. Criar `.env.example`, nunca `.env` com segredos.
5. Subir PostgreSQL e n8n localmente.
6. Implementar Worker com health/readiness.
7. Implementar modelo de dados e migrations.
8. Implementar adaptador manual.
9. Implementar aprovação Telegram.
10. Implementar publicação idempotente.
11. Adicionar uma fonte oficial.
12. Só então avaliar Playwright por fonte.

### Restrições para a IA

- Não inventar APIs.
- Não presumir permissão para scraping.
- Não pedir que o usuário cole tokens em chat.
- Não hardcodar IDs ou secrets.
- Não executar ações irreversíveis sem confirmação.
- Não ativar publicação pública durante testes.
- Não usar `latest` em produção.
- Não ignorar erros para “fazer funcionar”.
- Não construir lógica crítica somente em Code nodes do n8n.
- Não tentar resolver captcha automaticamente.

### Primeira entrega esperada

Um PR contendo:

- skeleton do monorepo;
- compose local;
- Worker health/readiness;
- migrations iniciais;
- `.env.example` completo;
- workflow manual → aprovação → publicação privada;
- testes;
- README de setup;
- ADR-001 justificando n8n + Worker separado.

---

## 30. Recomendações finais

1. **Começar simples:** oferta manual entrando no n8n, aprovação e publicação. Isso valida o canal e o modelo de mensagem.
2. **Automatizar primeiro uma fonte oficial:** evita construir o negócio sobre scraping frágil.
3. **Manter Mercado Livre experimental:** URLs `MLBU` e o portal não se comportam como API pública de afiliados.
4. **Usar Playwright em serviço separado:** facilita testes, manutenção, timeouts e segurança.
5. **Aprovação humana no MVP:** protege a reputação do canal e evita preços falsos.
6. **Banco como fonte de verdade:** histórico e idempotência não podem depender somente do n8n.
7. **Versionar workflows e código:** toda mudança precisa ser revisável e reversível.
8. **Tratar sessão do navegador como senha:** nunca Git, nunca chat, nunca log.
9. **Fixar versões:** atualizar n8n/Playwright somente com testes.
10. **Medir antes de escalar:** taxa de sucesso, conversão, cliques, comissão e custo operacional.

---

## 31. Referências oficiais consultadas

- [n8n — repositório oficial](https://github.com/n8n-io/n8n)
- [n8n Hosting — exemplos oficiais](https://github.com/n8n-io/n8n-hosting)
- [n8n Docs](https://docs.n8n.io/)
- [n8n Security Audit](https://docs.n8n.io/hosting/securing/security-audit/)
- [n8n Source Control and Environments](https://docs.n8n.io/source-control-environments/create-environments/)
- [Playwright — repositório oficial](https://github.com/microsoft/playwright)
- [Playwright Authentication](https://playwright.dev/docs/auth)
- [Playwright Codegen e storage state](https://playwright.dev/docs/codegen)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Mercado Livre — Portal do Afiliado](https://www.mercadolivre.com.br/l/afiliados-portal-do-afiliado)
- [Mercado Livre — Gerador de Links](https://www.mercadolivre.com.br/l/afiliados-gere-seus-links)
- [Mercado Livre Developers](https://developers.mercadolivre.com.br/)
- [Browserless — repositório e licença](https://github.com/browserless/browserless)

---

## 32. Conclusão

A solução final da Freguesia deve usar o n8n como orquestrador, não como local de toda a lógica. O Worker TypeScript/Playwright cria uma fronteira testável para fontes e páginas. PostgreSQL protege histórico, auditoria e idempotência. Telegram oferece aprovação e distribuição. APIs/feeds oficiais têm prioridade; navegador é um adaptador controlado, não uma licença para burlar plataformas.

Essa arquitetura permite começar com baixo risco, gerar valor cedo e evoluir para maior automação sem reescrever toda a plataforma.
