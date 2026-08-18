# Freguesia — Guia definitivo de integração com plataformas de afiliados

> Manual operacional para conectar a infraestrutura já construída às redes de afiliados, importar ofertas, normalizar produtos, comparar preços entre lojas e publicar no Telegram.

**Versão:** 1.0  
**Data de validação da documentação:** 16 de agosto de 2026  
**Escopo:** integrações externas; este documento pressupõe que bot, API interna, banco, filas, n8n e publicação no Telegram já existem.

---

## 1. Resultado esperado

Ao concluir este guia, o sistema deverá:

1. importar ofertas somente de fontes autorizadas;
2. preservar o link de afiliado e sua atribuição;
3. obter título, preço, preço anterior, moeda, imagem, estoque e identificadores do produto;
4. converter cada origem para um contrato interno único;
5. identificar o mesmo produto em lojas diferentes;
6. comparar o custo total conhecido, não apenas o preço nominal;
7. publicar a opção mais barata e, opcionalmente, até três alternativas;
8. informar quando frete, imposto ou cupom não puderem ser confirmados;
9. não publicar dados vencidos, links sem atribuição ou comparações inseguras;
10. registrar toda decisão para auditoria e revisão.

---

## 2. Decisão de arquitetura

O n8n continuará sendo o orquestrador. Cada plataforma terá um **adapter** isolado, mas todos entregarão o mesmo objeto normalizado ao pipeline central.

```text
Plataforma oficial / feed / entrada assistida
                ↓
        Workflow adapter do n8n
                ↓
     validação + normalização + cache
                ↓
 banco: sources, merchants, products, offers
                ↓
     resolução de identidade do produto
                ↓
 comparação do custo total + score de confiança
                ↓
       fila de revisão ou publicação
                ↓
               Telegram
```

Não deve existir um único workflow gigante. Use um workflow por fonte e subworkflows compartilhados:

- `INT-00 Normalize Offer`
- `INT-01 Validate Affiliate URL`
- `INT-02 Upsert Product and Offer`
- `INT-03 Match Product Identity`
- `INT-04 Compare Offers`
- `INT-05 Queue for Review`
- `INT-06 Publish Telegram`
- `INT-07 Record Click Reference`
- `INT-08 Refresh Stale Offer`
- `INT-09 Dead-letter Handler`

---

## 3. Verdades importantes antes da configuração

### 3.1 API comercial, API de vendedor e API de afiliado são coisas diferentes

- Uma API de vendedor permite gerir anúncios, pedidos e estoque da própria loja. Ela não concede automaticamente acesso ao catálogo inteiro nem cria comissão de afiliado.
- Uma API de afiliado fornece catálogo/ofertas e links atribuídos ao publisher.
- Um webhook de conversão confirma vendas; ele não é uma fonte de ofertas.
- Um sandbox prova apenas a integração técnica. Não garante catálogo real, comissão ou permissão para produção.

### 3.2 Estratégia permitida por ordem de preferência

1. API oficial de afiliados.
2. Feed oficial do programa ou da rede.
3. API oficial de catálogo + gerador oficial de link de afiliado.
4. Campanhas/cupons exportados pelo painel.
5. Entrada assistida: operador cola o link oficial já afiliado e o sistema enriquece somente com meios permitidos.

Scraping, automação de navegador e cookies de sessão só podem ser considerados após revisão escrita dos termos e autorização da plataforma. Nunca armazene cookie pessoal para simular o Link Builder.

### 3.3 Situação das plataformas em agosto de 2026

| Plataforma | Fonte recomendada | Gera link afiliado? | Catálogo/preço/imagem? | Situação para o MVP |
|---|---|---:|---:|---|
| Lomadee | REST API oficial | Sim, por canal/campanha/produto | Sim | Prioridade 1 |
| Awin | Offers API + Product Feed + Link Builder | Sim | Sim, via feed; oferta pode não ter imagem | Prioridade 1 |
| AliExpress | Affiliate API liberada no console | Sim | Sim | Prioridade 2 |
| Amazon | **Creators API**, não a antiga PA-API | Sim, resposta atribuída | Sim | Prioridade 2 após elegibilidade |
| Shopee | Shopee Affiliate Open API, se aprovada | Sim | Sim | Prioridade 2; não confundir com Seller Open Platform |
| SHEIN | API/feed somente se fornecido pelo programa ou rede | Depende do contrato | Depende | Integrar via Awin/Lomadee quando disponível; caso contrário, assistido |
| Monetizze | Vitrine/link pelo painel + webhook oficial | Link obtido no painel | Webhook não é catálogo | Entrada assistida + confirmação de conversão |
| Mercado Livre | Programa de Afiliados + ferramenta oficial; API pública de marketplace para recursos liberados | Não há API pública de afiliado documentada para automação geral | API pública é limitada pelo recurso/ID | Assistido até canal oficial específico |

**Regra:** nunca substituir uma indisponibilidade oficial por endpoint privado descoberto no navegador.

---

## 4. Variáveis de ambiente

Crie as variáveis no cofre de segredos da infraestrutura e credenciais nativas do n8n. O arquivo `.env.example` pode conter apenas nomes e valores falsos.

### 4.1 Núcleo

```dotenv
APP_ENV=production
APP_TIMEZONE=America/Sao_Paulo
APP_BASE_URL=https://api.seudominio.com
INTERNAL_API_BASE_URL=http://api:8080
INTERNAL_API_TOKEN=replace_me
WEBHOOK_SIGNING_SECRET=replace_me

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=freguesia
POSTGRES_USER=freguesia_app
POSTGRES_PASSWORD=replace_me

REDIS_URL=redis://redis:6379/0
TELEGRAM_BOT_TOKEN=replace_me
TELEGRAM_CHANNEL_ID=@freguesia
TELEGRAM_REVIEW_CHAT_ID=replace_me

DEFAULT_COUNTRY=BR
DEFAULT_CURRENCY=BRL
DEFAULT_LANGUAGE=pt-BR
DEFAULT_POSTAL_CODE=replace_me
DEFAULT_COMPARISON_REGION=BR
```

### 4.2 Políticas do pipeline

```dotenv
OFFER_MAX_AGE_MINUTES=60
OFFER_RECHECK_BEFORE_PUBLISH_MINUTES=10
MIN_DISCOUNT_PERCENT=10
MIN_MATCH_CONFIDENCE_AUTO=0.92
MIN_MATCH_CONFIDENCE_REVIEW=0.75
MAX_ALTERNATIVES_PER_POST=3
ALLOW_UNKNOWN_SHIPPING=false
ALLOW_OUT_OF_STOCK=false
REQUIRE_AFFILIATE_LINK=true
REQUIRE_IMAGE=true
REQUIRE_PRICE=true
REQUIRE_MANUAL_REVIEW=false
PRICE_CHANGE_ABORT_PERCENT=5
DEFAULT_HTTP_TIMEOUT_MS=30000
HTTP_RETRY_MAX=4
HTTP_RETRY_BASE_MS=1000
```

### 4.3 Lomadee

```dotenv
LOMADEE_ENABLED=true
LOMADEE_BASE_URL=https://api.lomadee.com.br
LOMADEE_API_KEY=
LOMADEE_CHANNEL_ID=
LOMADEE_PAGE_LIMIT=100
LOMADEE_SYNC_CRON=*/20 * * * *
```

### 4.4 Awin

```dotenv
AWIN_ENABLED=true
AWIN_BASE_URL=https://api.awin.com
AWIN_API_TOKEN=
AWIN_PUBLISHER_ID=
AWIN_REGION_CODE=BR
AWIN_PAGE_SIZE=200
AWIN_MEMBERSHIP=joined
AWIN_FEED_LOCALE=pt_BR
AWIN_SYNC_CRON=5 */1 * * *
```

Se for usado o feed legado, sua chave de Product Feed pode ser diferente do bearer token:

```dotenv
AWIN_PRODUCT_FEED_API_KEY=replace_me
```

### 4.5 AliExpress

```dotenv
ALIEXPRESS_ENABLED=false
ALIEXPRESS_APP_KEY=replace_me
ALIEXPRESS_APP_SECRET=replace_me
ALIEXPRESS_TRACKING_ID=replace_me
ALIEXPRESS_APP_SIGNATURE=replace_me
ALIEXPRESS_GATEWAY_URL=https://api-sg.aliexpress.com/sync
ALIEXPRESS_TARGET_CURRENCY=BRL
ALIEXPRESS_TARGET_LANGUAGE=PT
ALIEXPRESS_SHIP_TO_COUNTRY=BR
ALIEXPRESS_PAGE_SIZE=50
ALIEXPRESS_SYNC_CRON=10 */2 * * *
```

O gateway e os parâmetros efetivamente liberados devem ser copiados do console do app. Não presuma um domínio com base em exemplos antigos.

### 4.6 Amazon Creators API

```dotenv
AMAZON_ENABLED=false
AMAZON_CREATORS_CLIENT_ID=replace_me
AMAZON_CREATORS_CLIENT_SECRET=replace_me
AMAZON_PARTNER_TAG=replace_me
AMAZON_MARKETPLACE=www.amazon.com.br
AMAZON_REGION=replace_from_official_docs
AMAZON_LANGUAGE=pt_BR
AMAZON_SYNC_CRON=15 */2 * * *
```

Não iniciar nova implementação com `AMAZON_PAAPI_ACCESS_KEY` e `AMAZON_PAAPI_SECRET_KEY`: a PA-API foi descontinuada em 15/05/2026. O app sandbox criado anteriormente deve ser migrado/registrado conforme o portal Creators API.

### 4.7 Shopee Affiliate Open API

```dotenv
SHOPEE_AFFILIATE_ENABLED=false
SHOPEE_AFFILIATE_APP_ID=replace_me
SHOPEE_AFFILIATE_SECRET=replace_me
SHOPEE_AFFILIATE_BASE_URL=copy_from_affiliate_console
SHOPEE_AFFILIATE_ID=replace_me
SHOPEE_REGION=BR
SHOPEE_SYNC_CRON=20 */2 * * *
```

Não reutilizar `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY` ou tokens de loja da Open Platform de vendedores sem confirmação explícita de que pertencem à Affiliate Open API.

### 4.8 SHEIN

```dotenv
SHEIN_ENABLED=false
SHEIN_INTEGRATION_MODE=network
SHEIN_NETWORK=awin
SHEIN_ADVERTISER_ID=replace_me
SHEIN_FEED_URL=
SHEIN_API_BASE_URL=
SHEIN_API_KEY=
```

`SHEIN_INTEGRATION_MODE` deve ser `network`, `official_feed`, `official_api` ou `assisted`. Só preencher API se as credenciais vierem do portal/gerente oficial.

### 4.9 Monetizze

```dotenv
MONETIZZE_ENABLED=true
MONETIZZE_MODE=assisted
MONETIZZE_WEBHOOK_SECRET=replace_me
MONETIZZE_WEBHOOK_PATH=/webhooks/monetizze
MONETIZZE_AFFILIATE_ID=replace_me
```

### 4.10 Mercado Livre

```dotenv
MELI_ENABLED=true
MELI_MODE=assisted
MELI_CLIENT_ID=replace_me
MELI_CLIENT_SECRET=replace_me
MELI_REDIRECT_URI=https://api.seudominio.com/oauth/mercadolivre/callback
MELI_SITE_ID=MLB
MELI_AFFILIATE_TAG=replace_me
MELI_AFFILIATE_TOOL_ID=
```

As credenciais OAuth dão acesso apenas aos recursos autorizados da API pública. Elas não transformam automaticamente URL `/up/MLBU...` em item clássico nem criam link de afiliado.

---

#### 🕷️ Módulo Complementar: Captura via Web Scraping (Ofertas do Dia)

Como a API oficial (OAuth) não fornece endpoints para mineração de promoções gerais da plataforma ou conversão automática de links promocionais encurtados, o bot utiliza um módulo de **Web Scraping** em paralelo.

##### ⚙️ Funcionamento do Scraper
Este submódulo ignora a autenticação da API pública e varre diretamente o front-end do e-commerce.

*   **Alvo Primário:** `https://mercadolivre.com.br`
*   **Estratégia:** Utiliza navegadores headless (Playwright/Puppeteer ou Selenium) combinados com proxies residenciais rotativos e falsificação de *User-Agent* para contornar a segurança (Cloudflare/Akamai).
*   **Extração de Dados:** Captura o título, preços (antigo e atual), imagem e a **URL limpa** do produto direto do HTML da página de descontos.

##### 🔗 Integração com o Pipeline de Afiliados
1.  **Filtro:** O bot raspa os produtos da página de Ofertas do Dia e seleciona apenas os itens que atendem aos critérios de desconto mínimo configurados.
2.  **Identificação do Item:** O scraper traduz a página em um ID de item clássico (ex: `MLB12345678`), contornando o problema de links promocionais do tipo `/up/MLBU...`.
3.  **Monetização:** Com o ID do item ou a URL limpa em mãos, o sistema aciona o fluxo assistido (`MELI_MODE=assisted`) utilizando automação de navegador no Portal do Afiliado para injetar as tags de rastreamento (`MELI_AFFILIATE_TAG`) e gerar o link final comissão.


---

## 5. Contrato interno obrigatório

Todo adapter deve devolver um array de objetos neste formato. Campos inexistentes recebem `null`, nunca texto inventado.

```json
{
  "schema_version": "1.0",
  "source": "awin",
  "source_offer_id": "123456",
  "source_product_id": "SKU-ABC",
  "merchant_id": "awin:789",
  "merchant_name": "Loja Exemplo",
  "title": "Smartphone Marca X Modelo Y 256 GB Preto",
  "brand": "Marca X",
  "model": "Modelo Y",
  "variant": {
    "color": "Preto",
    "size": null,
    "storage": "256 GB",
    "voltage": null,
    "pack_count": 1
  },
  "identifiers": {
    "gtin": "07891234567890",
    "ean": "7891234567890",
    "isbn": null,
    "mpn": "XY-256-BLK",
    "asin": null
  },
  "category_path": ["Eletrônicos", "Celulares"],
  "condition": "new",
  "price": {
    "current": 1999.90,
    "original": 2499.90,
    "currency": "BRL",
    "discount_percent": 20.00,
    "installments": 10,
    "installment_value": 199.99,
    "payment_method_restriction": null
  },
  "shipping": {
    "amount": null,
    "currency": "BRL",
    "destination_postal_code": null,
    "estimated_days_min": null,
    "estimated_days_max": null,
    "is_free": null,
    "confirmed": false
  },
  "tax": {
    "amount": null,
    "included": null,
    "confirmed": false
  },
  "coupon": {
    "code": null,
    "description": null,
    "discount_amount": null,
    "minimum_spend": null,
    "expires_at": null,
    "auto_applied": false
  },
  "availability": {
    "in_stock": true,
    "quantity": null
  },
  "urls": {
    "canonical": "https://loja.example/produto",
    "affiliate": "https://rede.example/tracking/...",
    "image": "https://cdn.example/image.jpg",
    "additional_images": []
  },
  "seller": {
    "name": "Loja Exemplo",
    "id": null,
    "rating": null,
    "official_store": null
  },
  "validity": {
    "starts_at": null,
    "ends_at": null,
    "fetched_at": "2026-08-16T12:00:00Z",
    "last_verified_at": "2026-08-16T12:00:00Z"
  },
  "tracking": {
    "campaign": "telegram_freguesia",
    "click_reference": "src-awin-offer-123456",
    "attribution_verified": true
  },
  "raw_hash": "sha256:...",
  "match_confidence": null
}
```

### Regras de normalização

- Dinheiro: `numeric(14,2)`; nunca `float` no banco.
- Moeda: ISO 4217 em maiúsculas.
- Datas: UTC ISO 8601; exibição em `America/Sao_Paulo`.
- GTIN/EAN: somente dígitos, zero à esquerda preservado e dígito verificador validado.
- Marca/modelo: manter valor original e versão normalizada separadamente no banco.
- URL de imagem: HTTPS, tipo permitido e resposta válida antes da publicação.
- `discount_percent = (original-current)/original*100`, somente se `original > current > 0`.
- Cupom condicionado não pode ser subtraído sem satisfazer o valor mínimo e demais termos.
- Cashback, pontos ou comissão do afiliado não reduzem o preço exibido ao consumidor.

---

## 6. Preparação comum no n8n

### 6.1 Credenciais

Crie uma credencial n8n por plataforma. Não coloque segredo em nós Code, URLs, nomes de workflow, logs ou mensagens Telegram.

Sugestão de nomes:

- `cred_lomadee_api_prod`
- `cred_awin_bearer_prod`
- `cred_aliexpress_affiliate_prod`
- `cred_amazon_creators_prod`
- `cred_shopee_affiliate_prod`
- `cred_internal_api_prod`
- `cred_telegram_freguesia_prod`

### 6.2 Padrão de workflow de coleta

```text
Schedule Trigger
→ Acquire distributed lock
→ Load sync cursor
→ HTTP Request/API client
→ Rate-limit guard
→ Split Out/Loop Over Items
→ Map source fields
→ Execute Workflow: INT-00 Normalize Offer
→ Execute Workflow: INT-01 Validate Affiliate URL
→ Execute Workflow: INT-02 Upsert Product and Offer
→ Save cursor
→ Release lock
```

### 6.3 HTTP resiliente

- Timeout: 30 s.
- Tentativas: 4 para `408`, `425`, `429`, `500`, `502`, `503`, `504`.
- Backoff: 1 s, 2 s, 4 s, 8 s com jitter.
- Respeitar `Retry-After`.
- Não repetir automaticamente `400`, `401`, `403`, `404`.
- Em `401`, desabilitar a fonte e alertar; em `403`, registrar escopo/adesão ausente.
- Usar cursor/página persistido para retomar sem duplicar.
- Aplicar idempotency key interna: `source + source_offer_id + price + valid_until`.

---

## 7. Lomadee

Documentação: <https://docs.lomadee.com.br/api-reference/introduction>

### 7.1 Obter acesso

1. Entrar no painel Lomadee como afiliado.
2. Criar/confirmar o canal que representa o Telegram/site Freguesia.
3. Solicitar/criar a API key com os escopos de leitura necessários.
4. Guardar `LOMADEE_API_KEY` e obter `LOMADEE_CHANNEL_ID` por `GET /affiliate/channels`.
5. Aderir às marcas; marca listada não significa aprovação para promovê-la.

A produção usa `https://api.lomadee.com.br`; o host `api-beta` é legado e está em transição para retirada.

### 7.2 Autenticação

Em todo HTTP Request:

```http
x-api-key: {{$credentials.lomadeeApi.apiKey}}
Accept: application/json
```

Limite documentado: 60 requisições por 60 segundos por chave + IP. Ler `X-RateLimit-Remaining`, `X-RateLimit-Reset` e `Retry-After`.

### 7.3 Testes de conexão

1. `GET https://api.lomadee.com.br/affiliate/channels`
2. `GET https://api.lomadee.com.br/affiliate/brands?page=1&limit=20`
3. Confirmar `200`, canal correto e marcas com status permitido.

### 7.4 Coleta de campanhas

Use o endpoint de campanhas listado na referência atual. Filtre campanhas ativas, datas válidas e marcas aprovadas. Tipos úteis: `Offer`, `GenericCoupon` e, somente se aplicável ao usuário, `PersonalCoupon`.

O adapter deve mapear:

- ID da campanha;
- título, descrição e termos;
- tipo e código do cupom;
- início/fim;
- marca;
- URL afiliada retornada pela API;
- categorias/tags.

### 7.5 Coleta de produtos

Use `GET /affiliate/products`, paginação de no máximo 100 e filtros oficiais disponíveis. A API documenta produtos com preço, estoque, variantes, imagens e especificações.

Não pesquise o catálogo inteiro a cada minuto. Estratégia:

1. sincronização completa noturna;
2. busca incremental por categorias e marcas em intervalos de 20–60 min;
3. revalidação da oferta imediatamente antes de publicar;
4. cache de detalhes por 30–60 min.

### 7.6 Encurtamento

Use `POST /affiliate/shorten` somente quando necessário. Armazene a URL longa oficial e a curta. Antes de publicar, valide que o redirecionamento termina no domínio esperado e preserva atribuição.

### 7.7 Critério de aceite

- Canal pertence à conta.
- Marca aprovada.
- Produto tem preço, estoque, imagem e URL afiliada.
- Link de teste aparece no relatório de clique, quando a plataforma permitir.
- `429` é tratado sem perder cursor.

---

## 8. Awin

Documentação de autenticação: <https://help.awin.com/apidocs/api-authentication>  
Offers: <https://help.awin.com/apidocs/promotions>  
Link Builder: <https://help.awin.com/apidocs/generatelink>  
Enhanced Feed: <https://help.awin.com/apidocs/retail-publisher-productapidocumentation-1>

### 8.1 Preparação no painel

1. Usar conta Publisher com permissão Admin.
2. Em **API Credentials**, gerar o token pessoal.
3. Aderir individualmente aos anunciantes desejados.
4. Descobrir o Publisher ID consultando `GET /accounts?type=publisher`.
5. Conferir se cada anunciante oferece feed e permite deep linking.

### 8.2 Autenticação

```http
Authorization: Bearer {{$credentials.awinBearer.token}}
Accept: application/json
```

### 8.3 Offers API

```http
POST https://api.awin.com/publisher/{publisherId}/promotions
```

Configurar os filtros conforme a documentação atual:

- `membership=joined`;
- região Brasil;
- `status=active`;
- `type=all`;
- `pageSize=200`;
- paginação até o fim.

O campo `urlTracking` é a URL atribuída preferencial. Não passe novamente pelo Link Builder se ele já estiver presente.

Offers serve principalmente para campanhas e vouchers. Não assuma que terá imagem, SKU e preço estruturado.

### 8.4 Product Feed

Para comparação de produtos, prefira o Enhanced Feed ou feed de produto disponibilizado pelo anunciante. O Enhanced Feed documentado usa:

```http
GET https://api.awin.com/publishers/{PUBLISHER_ID}/awinfeeds/download/{ADVERTISER_ID}-retail-{LOCALE}.jsonl
Authorization: Bearer TOKEN
```

Campos mínimos a solicitar/mapear:

- `id`, `title`, `description`;
- `link`/deep link;
- `image_link`, `additional_image_link`;
- `price`, `sale_price`, moeda;
- `availability`, `condition`;
- `brand`, `gtin`, `mpn`;
- categoria, tamanho, cor e variante.

Processar JSONL em streaming. Não carregar feeds grandes inteiros na memória do n8n. Se o arquivo for volumoso, delegar download, descompressão e parsing ao worker já existente; o n8n apenas inicia o job e consome os lotes normalizados.

### 8.5 Link Builder

Quando o feed não trouxer deep link:

```http
POST https://api.awin.com/publishers/{publisherId}/linkbuilder/generate
Content-Type: application/json

{
  "advertiserId": 123,
  "destinationUrl": "https://loja.example/produto",
  "parameters": {
    "campaign": "freguesia_telegram",
    "clickref": "offer_internal_uuid"
  },
  "shorten": false
}
```

Use batch de até 100 quando apropriado. Alguns anunciantes não permitem deep link; o workflow deve marcar `deeplink_not_permitted`, e não improvisar URL.

### 8.6 Critério de aceite

- Token válido e Publisher ID correto.
- Relação `joined` com o anunciante.
- Feed parseado sem truncamento.
- Link atribuído contém a rota da Awin ou URL oficial devolvida.
- `clickref` único permite reconciliar clique/conversão.

---

## 9. AliExpress Affiliate API

Referência de método oficial: <https://open.alitrip.com/docs/api.htm?apiId=45803>

### 9.1 Preparação

1. Ter conta ativa no programa de afiliados AliExpress.
2. Criar app no portal oficial aplicável à conta/região.
3. Solicitar os métodos de Affiliate API; um App Key comum não garante permissão.
4. Criar/obter `tracking_id`.
5. Copiar gateway, App Key e Secret do console.
6. Validar país de envio `BR`, moeda `BRL` e idioma suportado.

### 9.2 Assinatura

As requisições usam parâmetros comuns como `app_key`, `method`, `timestamp`, `format`, `v`, `sign_method` e `sign`. Implemente assinatura no adapter/worker, não em expressões espalhadas pelo n8n.

Regras:

- ordenar parâmetros exatamente como exige a documentação do console;
- excluir o próprio `sign` da entrada da assinatura;
- timestamp sincronizado por NTP;
- segredo somente no cofre;
- logar parâmetros não sensíveis e hash da requisição, nunca o secret.

### 9.3 Métodos

Usar os métodos liberados no app, tipicamente:

- consulta de produtos: `aliexpress.affiliate.product.query`;
- detalhes de produto;
- geração de links afiliados;
- categorias/hot products;
- relatório de pedidos.

Na consulta, solicitar explicitamente campos de preço, preço original, comissão, URL/imagem, IDs, envio e moeda de destino. Use `SORT=SALE_PRICE_ASC` apenas como descoberta; o comparador interno decide a melhor oferta.

### 9.4 Particularidades

- O preço do app pode diferir do site.
- Imposto e frete dependem do CEP, país, armazém e variante.
- Produto visualmente igual pode ter quantidade, plugue ou capacidade diferente.
- Não publicar “mais barato” se custo de importação/frete for desconhecido; escrever “menor preço anunciado entre as ofertas verificadas”.

### 9.5 Critério de aceite

- Assinatura validada em produção.
- Link gerado com o tracking ID correto.
- Preço e moeda correspondem à variante.
- Envio para Brasil confirmado ou sinalizado como desconhecido.
- Rate limit e erros de permissão tratados.

---

## 10. Amazon Associates — Creators API

Documentação: <https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction>

### 10.1 Migração obrigatória

A Product Advertising API 5.0 foi descontinuada em **15 de maio de 2026**. Toda integração nova deve usar **Creators API**. Não use tutoriais ou SDKs PA-API como base arquitetural.

### 10.2 Elegibilidade

Segundo a documentação atual, é necessário:

1. estar inscrito no Amazon Associates do marketplace alvo;
2. ter pelo menos 10 vendas qualificadas nos últimos 30 dias para acesso;
3. registrar acesso no Associates Central;
4. gerar credenciais da Creators API.

O Partner Tag deve pertencer ao Brasil se o marketplace for `amazon.com.br`.

### 10.3 Operações

- `SearchItems`: descoberta por termos, filtros e browse nodes;
- `GetItems`: detalhes por ASIN/identificador;
- `GetVariations`: variações do item pai;
- `GetBrowseNodes`: categorias.

O endpoint, OAuth/credencial e formato final devem ser copiados da seção **Get Started/API Reference** da conta, pois podem variar por versão/locale.

### 10.4 Recursos solicitados

Solicitar título, imagens, ASIN, marca/modelo, informações de item, OffersV2/preço, disponibilidade e URL detalhada atribuída. Preservar a `DetailPageURL` devolvida; não remover nem reescrever a tag.

### 10.5 Regras de conteúdo

- Exibir disclosure de afiliado exigido pela Amazon.
- Observar licença de uso de imagem, preço e conteúdo.
- Não manter preço além do período permitido pela política; atualizar conforme exigido.
- Não alterar links retornados.
- Não apresentar preço de marketplace/variante diferente como se fosse o mesmo item.

### 10.6 Sandbox

O sandbox valida contrato, autenticação e parsing. O teste final precisa ocorrer com credencial de produção elegível e Partner Tag válido. Dados simulados nunca alimentam o canal público.

### 10.7 Critério de aceite

- Creators API, e não PA-API, aparece nos logs de versão.
- ASIN e variante corretos.
- URL mantém Partner Tag.
- Política de cache implementada.
- Disclosure presente.

---

## 11. Shopee Affiliate Open API

### 11.1 Não confundir produtos

A Shopee Open Platform de seller/partner não equivale à Affiliate Open API. Para o bot, solicite acesso no portal de afiliados, normalmente a partir de `affiliate.shopee.com.br/open_api` e suporte da conta. Só habilite o adapter quando receber App ID/Secret específicos da API de afiliados.

### 11.2 Operações esperadas

A versão liberada à conta pode expor operações como:

- Shopee Offer;
- Shop Offer;
- Product Offer;
- Short Link;
- relatórios de conversão/validação.

Use a referência mostrada dentro do painel autenticado como fonte canônica. Não implemente a partir de documentação comunitária sem comparar nomes, assinatura e endpoint.

### 11.3 Assinatura

Centralize no adapter:

- montagem do corpo GraphQL/JSON conforme a versão;
- timestamp;
- assinatura HMAC conforme instrução oficial;
- cabeçalhos;
- paginação/cursor;
- backoff e códigos de erro.

### 11.4 Dados

Mapear item ID, shop ID, título, imagem, preço, desconto, comissão, estoque/vendas quando fornecidos e short link atribuído. `itemId + shopId + modelId/variationId` forma a identidade de origem; `itemId` sozinho pode não identificar a variante.

### 11.5 Sem aprovação da API

Usar `SHOPEE_AFFILIATE_ENABLED=false` e workflow assistido:

1. operador gera link no painel/app oficial;
2. envia ao endpoint `/ingest/assisted`;
3. bot valida domínio e preserva link;
4. dados só são enriquecidos por fonte permitida;
5. oferta vai para revisão.

Não automatizar login, CAPTCHA ou cookie da conta.

---

## 12. SHEIN

### 12.1 Rota recomendada

Primeiro procure a SHEIN como anunciante dentro da Awin ou Lomadee da conta brasileira. Se aprovada e com feed, use o adapter da rede e marque:

```json
{
  "source": "awin",
  "merchant_name": "SHEIN",
  "merchant_id": "awin:<advertiser_id>"
}
```

Isso evita manter uma integração adicional e usa link/feed autorizados.

### 12.2 API direta

Somente implementar se a SHEIN fornecer oficialmente:

- portal/documentação;
- base URL;
- credenciais;
- escopos de catálogo e afiliado;
- regras de assinatura;
- permissão de uso de imagens/preços;
- geração de tracking link.

Até isso ocorrer, `SHEIN_INTEGRATION_MODE=network` ou `assisted`.

### 12.3 Comparação de moda

Não comparar apenas pelo título. Tamanho, cor, composição e SKU/modelo devem coincidir. Para roupas sem GTIN/MPN confiável, exigir correspondência de SKU global ou revisão humana.

---

## 13. Monetizze

Documentação oficial de webhook: <https://apidoc.monetizze.com.br/postback/index.html>

### 13.1 Limitação

O webhook oficial recebe eventos de venda, assinatura, rastreio e eventos. Ele não deve ser tratado como API de descoberta da Vitrine.

### 13.2 Fluxo de ofertas

1. Afiliar-se ao produto na Vitrine.
2. Obter o link de divulgação oficial no painel.
3. Enviar link, nome, preço, imagem autorizada, validade e produtor ao formulário/API assistida do Freguesia.
4. Exigir revisão antes de publicar.
5. Guardar ID do produto/plano quando fornecido.

Para produtos digitais, a comparação entre lojas geralmente não se aplica. Classifique `comparison_eligible=false`, exceto quando houver identificador e entrega realmente equivalentes.

### 13.3 Webhook

No painel: **Ferramentas → Postback / Webhook → Novo Webhook**.

Configurar:

```text
Tipo: Server to Server
URL: https://api.seudominio.com/webhooks/monetizze
Formato: application/json
Eventos: venda aprovada, cancelada, reembolsada e demais necessários
```

O endpoint deve:

1. receber o corpo bruto;
2. validar mecanismo oficial de autenticidade disponível;
3. responder rapidamente `2xx` após persistir em fila;
4. deduplicar pelo campo `id` do webhook;
5. não usar `chave_unica` para deduplicação;
6. atualizar comissão/conversão de forma assíncrona.

### 13.4 Critério de aceite

- Teste do painel retorna `2xx`.
- Reenvio com mesmo `id` não duplica conversão.
- Cancelamento/reembolso atualiza status.
- Nenhum dado pessoal é enviado ao Telegram ou logado sem necessidade.

---

## 14. Mercado Livre

Documentação da API: <https://developers.mercadolivre.com.br/pt_br>  
Programa de Afiliados: use a Central de Afiliados e Criadores da conta brasileira.

### 14.1 Separar dois sistemas

- OAuth/API de marketplace: recursos oficialmente liberados, principalmente operações relacionadas a usuários/anúncios.
- Programa de afiliados: escolha de produtos e geração de links pelas ferramentas oficiais.

O app OAuth criado não garante uma API pública para gerar links de afiliado nem para resolver todo Product Page (`/up/MLBU...`). Esse foi o motivo dos erros anteriores.

### 14.2 Modo seguro atual

1. Descobrir produto pelo canal oficial ou manualmente.
2. Gerar link na Barra/Central oficial de afiliados.
3. Enviar link ao endpoint assistido.
4. Preservar a URL exatamente como gerada.
5. Obter dados de item apenas de endpoint público/documentado que aceite o identificador real.
6. Se título, preço ou imagem não vierem oficialmente, exigir preenchimento/revisão manual.

### 14.3 OAuth

Manter OAuth apenas para recursos documentados:

- `client_id`, `client_secret`, redirect HTTPS idêntico ao cadastrado;
- authorization code de uso único;
- access token cifrado;
- refresh token rotacionado de forma atômica;
- escopo mínimo de leitura;
- nunca enviar token ao n8n em texto aberto/log.

### 14.4 Proibições operacionais

- Não capturar cookie da Central de Afiliados.
- Não chamar endpoint privado visto no DevTools.
- Não acrescentar parâmetro de afiliado por suposição.
- Não usar scraping para contornar `resource not found`.
- Não declarar que URL comum gera comissão sem validação.

---

## 15. Entrada assistida universal

Enquanto uma plataforma não tiver API/feed aprovado, oferecer:

```http
POST /v1/assisted-offers
Authorization: Bearer INTERNAL_OPERATOR_TOKEN
Content-Type: application/json
```

```json
{
  "platform": "mercado_livre",
  "affiliate_url": "https://link-oficial.example/...",
  "canonical_url": "https://loja.example/produto",
  "title": "Produto",
  "price": 99.90,
  "original_price": 129.90,
  "currency": "BRL",
  "image_url": "https://cdn.example/image.jpg",
  "coupon_code": null,
  "expires_at": null,
  "operator_notes": "Link gerado no painel oficial"
}
```

O sistema valida tipos, domínio, HTTPS, imagem, preço e duplicidade; marca `source=assisted:<platform>` e sempre envia à revisão.

---

## 16. Comparação do mesmo produto

### 16.1 Regra de ouro

Comparar somente itens realmente equivalentes: mesma marca, modelo, capacidade, cor quando altera preço, voltagem, quantidade do kit, condição e região de entrega.

### 16.2 Hierarquia de identidade

1. GTIN/EAN/UPC/ISBN válido e variante compatível: confiança inicial `0.99`.
2. Marca + MPN/modelo exato + variante: `0.96`.
3. ASIN mapeado a GTIN/MPN verificado: `0.95`.
4. Marca + modelo extraído + atributos fortes: `0.85–0.94`.
5. Similaridade textual/imagem sem identificador: no máximo `0.80`, revisão obrigatória.

Nunca usar apenas embeddings ou similaridade de título para publicação automática.

### 16.3 Normalização de título

- Unicode NFKC e minúsculas;
- remover pontuação promocional, não números de modelo;
- padronizar `gb`, `tb`, `ml`, `kg`, polegadas e voltagem;
- remover stopwords como “oferta”, “frete grátis”, “imperdível”;
- manter tokens alfanuméricos de modelo;
- extrair pack count (`kit 2`, `2 unidades`);
- tratar `127 V`, `110 V` e `220 V` explicitamente.

### 16.4 Bloqueadores de match

Um par não pode ser automático se houver conflito em:

- GTIN;
- marca;
- modelo principal;
- armazenamento/RAM;
- tamanho/cor relevante;
- voltagem;
- quantidade;
- condição novo/usado/recondicionado;
- versão nacional/importada quando muda garantia/especificação.

### 16.5 Score sugerido

```text
score =
  0.40 * identifier_score +
  0.20 * brand_model_score +
  0.15 * variant_score +
  0.10 * title_similarity +
  0.05 * category_score +
  0.05 * image_similarity +
  0.05 * seller_data_quality
```

Aplicar penalidade de `-1.0` para qualquer bloqueador duro. Limiares:

- `>= 0.92`: pode comparar automaticamente;
- `0.75–0.9199`: fila de revisão;
- `< 0.75`: produtos diferentes.

### 16.6 Custo comparável

```text
effective_price = current_price
                - eligible_coupon_discount
                + confirmed_shipping
                + confirmed_tax
                + mandatory_fee
```

Só inclua cupom se ativo, aplicável ao item/usuário e com mínimo satisfeito. Se frete/imposto forem desconhecidos:

- não afirmar “menor custo final”;
- mostrar “menor preço anunciado”;
- apresentar `frete a consultar`;
- preferencialmente reter para revisão se concorrentes têm custo completo.

### 16.7 Desempate

1. menor `effective_price`;
2. custo totalmente confirmado;
3. loja oficial/vendedor melhor avaliado;
4. entrega mais rápida;
5. dado mais recente;
6. maior confiança de match.

Comissão do Freguesia nunca entra no ranking.

---

## 17. Modelo de banco mínimo

### `affiliate_sources`

`id`, `code`, `enabled`, `mode`, `credential_ref`, `last_success_at`, `last_error_at`, `health_status`.

### `merchants`

`id`, `source_id`, `external_id`, `name`, `relationship_status`, `country`, `feed_enabled`.

### `products`

`id UUID`, `canonical_title`, `brand`, `model`, `gtin`, `ean`, `isbn`, `mpn`, `asin`, `category_id`, `condition`, `attributes JSONB`.

### `source_products`

`source_id`, `external_product_id`, `product_id`, `merchant_id`, `raw_title`, `raw_identifiers JSONB`, `raw_attributes JSONB`, `first_seen_at`, `last_seen_at`.

### `offers`

`id`, `source_product_id`, `variant_key`, `price`, `original_price`, `currency`, `shipping`, `tax`, `effective_price`, `stock_status`, `affiliate_url_encrypted/ref`, `canonical_url`, `image_url`, `coupon JSONB`, `starts_at`, `ends_at`, `fetched_at`, `verified_at`, `status`.

### `product_matches`

`left_source_product_id`, `right_source_product_id`, `score`, `method`, `evidence JSONB`, `status`, `reviewed_by`, `reviewed_at`.

### `publications`

`id`, `product_id`, `winning_offer_id`, `alternatives JSONB`, `telegram_message_id`, `payload_hash`, `published_at`, `retracted_at`.

### Restrições

- Unique: `(source_id, external_product_id, variant_key)`.
- Unique de evento/webhook por `(source_id, external_event_id)`.
- Índices em GTIN, MPN normalizado, brand/model, status/verified_at.
- Histórico de preço imutável em tabela `offer_price_history`.

---

## 18. Workflow de comparação no n8n

```text
Webhook/Execute Workflow: offer.changed
→ Buscar produto canônico e concorrentes ativos
→ Excluir ofertas vencidas/sem estoque
→ Revalidar ofertas perto do limite de idade
→ Calcular match confidence
→ IF conflito de variante: separar grupos
→ Calcular effective_price
→ Ordenar
→ IF confiança < 0.92: revisão
→ IF variação de preço > PRICE_CHANGE_ABORT_PERCENT: revalidar
→ Montar payload Telegram
→ Publicar
→ Gravar snapshot usado na decisão
```

Use transação/lock por `product_id` para impedir duas publicações simultâneas.

---

## 19. Formato da mensagem Telegram

```text
🔥 {produto}

🏆 Menor preço verificado: {loja_vencedora}
💰 R$ {preco_efetivo}
{preco_anterior_e_desconto}
{cupom_e_condicoes}
🚚 {frete_status}

🔗 Comprar: {link_afiliado}

Outras lojas:
• {loja_2}: R$ {preco_2} — {link_2}
• {loja_3}: R$ {preco_3} — {link_3}

Preços verificados às {hora}. Podem mudar.
O Freguesia pode receber comissão pelas compras, sem custo adicional para você.
```

Se frete não estiver confirmado, trocar “Menor preço verificado” por “Menor preço anunciado entre as ofertas verificadas”. Não usar urgência falsa nem desconto sem preço anterior confiável.

---

## 20. Segurança e conformidade

- Segredos somente no cofre/credentials do n8n.
- Cifrar tokens no banco; restringir descriptografia ao adapter.
- Redigir `Authorization`, `x-api-key`, secrets, cookies e query tokens dos logs.
- IP allowlist para webhooks quando oficialmente suportada.
- Assinatura/HMAC e proteção contra replay em webhooks.
- LGPD: coletar somente dados necessários; definir retenção e exclusão.
- Disclosure claro de afiliado no canal e nas mensagens.
- Respeitar licença de imagem/preço de cada rede.
- Kill switch por plataforma.
- Não seguir redirecionamento para domínio não permitido.
- SSRF protection ao validar URLs/imagens: bloquear IPs privados, metadata endpoints e protocolos não HTTP(S).
- Limite de tamanho e content type em imagens.
- Dependências fixadas por lockfile e atualizadas com revisão.

---

## 21. Observabilidade

### Métricas

- `affiliate_sync_requests_total{source,status}`
- `affiliate_offers_ingested_total{source}`
- `affiliate_offers_rejected_total{source,reason}`
- `affiliate_rate_limit_remaining{source}`
- `affiliate_sync_lag_seconds{source}`
- `product_match_total{status}`
- `product_match_confidence_bucket`
- `offer_price_age_seconds`
- `telegram_publish_total{status}`
- `affiliate_clicks_total{source,campaign}`
- `affiliate_conversions_total{source,status}`

### Alertas

- fonte sem sucesso por 2× o intervalo;
- `401/403` repetido;
- queda >70% no volume de ofertas;
- preço zero/negativo;
- imagem quebrada >10%;
- link afiliado ausente;
- fila de revisão crescendo;
- taxa de match automático alterada bruscamente;
- conversões zeradas por período incomum.

### Logs estruturados

Inclua `correlation_id`, `workflow`, `source`, `merchant_id`, `external_offer_id`, `product_id`, `attempt`, `http_status`, `duration_ms` e `decision_reason`. Nunca inclua segredo ou dados pessoais de comprador.

---

## 22. Testes e revisão de código

### 22.1 Testes por adapter

- autenticação válida/inválida;
- paginação, cursor e última página vazia;
- `429` com `Retry-After`;
- timeout e retry;
- resposta parcial/nula;
- preço em vírgula/ponto e moedas;
- cupom vencido;
- variante e estoque;
- URL sem atribuição;
- imagem quebrada;
- payload alterado pela plataforma;
- idempotência.

### 22.2 Testes de matching

- mesmo GTIN, títulos diferentes;
- mesmo título, voltagens diferentes;
- kits de 1 e 2 unidades;
- 128 GB versus 256 GB;
- novo versus recondicionado;
- livros com mesmo título, ISBN diferente;
- roupa mesma foto, tamanho/cor diferentes;
- falso desconto com preço anterior igual/inferior.

### 22.3 Contract tests

Salvar fixtures sanitizadas de respostas reais autorizadas. O adapter deve falhar de forma explícita se campos críticos mudarem, e nunca publicar objeto parcialmente interpretado.

### 22.4 Pull request obrigatório

Cada integração deve passar por PR com:

- referência da documentação oficial e data;
- escopos/permissões pedidos;
- mapa origem → contrato interno;
- política de rate limit/cache;
- riscos de termos/licença;
- fixtures e testes;
- rollback/kill switch;
- evidência de link atribuído em ambiente de teste.

### 22.5 Clean Code

- Um adapter não conhece Telegram.
- Comparador não conhece autenticação externa.
- Funções puras para dinheiro, datas e score.
- Nomes completos (`affiliateUrl`, não `url2`).
- Sem números mágicos; políticas em configuração versionada.
- Sem `catch` vazio.
- Erros tipados: `AuthenticationError`, `RateLimitError`, `PermissionError`, `SchemaDriftError`, `AttributionError`.
- Código Code node curto; lógica reutilizável fica no serviço/worker testável.
- Nunca duplicar algoritmo de assinatura entre workflows.

---

## 23. Git e ferramentas

### Repositórios recomendados no projeto

```text
freguesia/
├── apps/api/
├── apps/affiliate-worker/
├── packages/domain/
├── packages/adapters/
│   ├── lomadee/
│   ├── awin/
│   ├── aliexpress/
│   ├── amazon-creators/
│   ├── shopee-affiliate/
│   └── assisted/
├── packages/product-matching/
├── infra/n8n/workflows/
├── infra/database/migrations/
├── tests/contracts/fixtures/
└── docs/integrations/
```

Ferramentas:

- n8n self-hosted para orquestração;
- PostgreSQL para catálogo, preços, matches e auditoria;
- Redis + fila existente para jobs e locks;
- Node.js/TypeScript no worker, com cliente HTTP e validação de schema;
- Zod ou JSON Schema para contratos;
- Decimal.js ou dinheiro em centavos/decimal, nunca ponto flutuante comum;
- Vitest/Jest para unidade e contrato;
- Testcontainers para PostgreSQL/Redis em CI;
- ESLint, Prettier, TypeScript strict;
- Renovate/Dependabot;
- Sentry/OpenTelemetry/Prometheus conforme a stack já existente;
- GitHub Actions para lint, typecheck, testes, scan de segredos e imagens Docker.

Não adote um SDK comunitário só porque existe. Preferir HTTP oficial; se usar SDK, verificar mantenedor, versão, licença, CVEs, atividade e compatibilidade com a documentação atual.

---

## 24. Ordem de implantação

### Fase 1 — fundação

- [ ] Congelar contrato normalizado.
- [ ] Criar tabelas/migrations.
- [ ] Implementar validação de link e SSRF.
- [ ] Implementar comparação e fila de revisão.
- [ ] Configurar cofre, métricas e dead-letter queue.

### Fase 2 — fontes mais maduras

- [ ] Lomadee Products/Campaigns.
- [ ] Awin Offers/Product Feed/Link Builder.
- [ ] Testar match cruzado Lomadee × Awin.

### Fase 3 — marketplaces com API afiliada

- [ ] AliExpress após aprovação dos métodos.
- [ ] Shopee Affiliate Open API após credenciais específicas.
- [ ] Amazon Creators API após elegibilidade.

### Fase 4 — fontes condicionais

- [ ] SHEIN por Awin/Lomadee/feed oficial.
- [ ] Monetizze assistido + webhook de conversão.
- [ ] Mercado Livre assistido até API oficial de afiliados aplicável.

### Fase 5 — escala

- [ ] Ajustar frequência por taxa de conversão e freshness.
- [ ] A/B de formato da mensagem, sem manipular ranking.
- [ ] Painel de qualidade de matches.
- [ ] Reconciliação de cliques, pedidos, cancelamentos e comissão.

---

## 25. Checklist de ativação de uma plataforma

- [ ] Conta de afiliado aprovada.
- [ ] Anunciantes/produtos aprovados.
- [ ] Canal Telegram/site declarado no programa.
- [ ] Termos permitem o canal e automação planejada.
- [ ] Credenciais de produção guardadas no cofre.
- [ ] API correta: afiliado, não vendedor.
- [ ] Rate limit e paginação conhecidos.
- [ ] Link oficial atribuído comprovado.
- [ ] Direito de usar imagem/preço confirmado.
- [ ] Adapter produz schema interno completo.
- [ ] Revalidação antes da publicação.
- [ ] Testes de idempotência, erro e schema drift.
- [ ] Métricas/alertas ativos.
- [ ] Kill switch testado.
- [ ] Disclosure publicado.
- [ ] Revisão de código e compliance aprovada.

---

## 26. Critério de conclusão do projeto

A integração estará pronta somente quando um teste ponta a ponta demonstrar:

1. oferta obtida de fonte autorizada;
2. link atribuído à conta Freguesia;
3. imagem e preço dentro da licença e freshness;
4. produto corretamente identificado;
5. pelo menos duas lojas comparadas quando houver equivalência;
6. custo incompleto explicitamente sinalizado;
7. publicação Telegram sem segredo/dado pessoal;
8. clique rastreável;
9. conversão reconciliável quando a plataforma disponibilizar relatório/webhook;
10. reexecução sem duplicar oferta, post ou conversão.

---

## 27. Fontes oficiais principais

- Lomadee API: <https://docs.lomadee.com.br/api-reference/introduction>
- Awin Authentication: <https://help.awin.com/apidocs/api-authentication>
- Awin Retrieve Offers: <https://help.awin.com/apidocs/promotions>
- Awin Link Builder: <https://help.awin.com/apidocs/generatelink>
- Awin Enhanced Product Feed: <https://help.awin.com/apidocs/retail-publisher-productapidocumentation-1>
- AliExpress Affiliate Product Query: <https://open.alitrip.com/docs/api.htm?apiId=45803>
- Amazon Creators API: <https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction>
- Amazon aviso de descontinuação da PA-API: <https://webservices.amazon.com/paapi5/documentation/document-history.html>
- Monetizze Webhooks: <https://apidoc.monetizze.com.br/postback/index.html>
- Mercado Livre Developers: <https://developers.mercadolivre.com.br/pt_br>

Para Shopee e SHEIN, a documentação autenticada fornecida à conta aprovada deve prevalecer. Registrar no repositório a URL, versão e data vistas no portal antes de implementar.

---

## 28. Decisão final recomendada

Começar por **Lomadee + Awin**, pois oferecem o caminho mais completo e defensável para catálogo, imagem, preço e atribuição. Depois adicionar **AliExpress**, **Shopee Affiliate** e **Amazon Creators API** somente após aprovação real das credenciais. Tratar **SHEIN** preferencialmente como anunciante dentro de Awin/Lomadee. Usar **Monetizze** para entrada assistida e confirmação de vendas via webhook. Manter **Mercado Livre** em entrada assistida até a conta receber um mecanismo oficial e documentado de automação afiliada.

Essa ordem entrega comparação entre lojas rapidamente sem apoiar o negócio em scraping frágil, cookies de sessão ou APIs de vendedor que não foram feitas para afiliados.
