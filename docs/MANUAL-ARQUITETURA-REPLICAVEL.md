# Manual de arquitetura replicável do Freguesia

## 1. Propósito deste manual

Este documento ensina, do zero, como construir, operar, testar e recuperar uma arquitetura equivalente à do Freguesia. O exemplo concreto é um bot que encontra ofertas, pede aprovação humana e publica no Telegram, mas os componentes foram descritos como padrões reutilizáveis.

Ao terminar, uma pessoa iniciante ou uma IA deve conseguir:

1. explicar a responsabilidade de cada componente;
2. criar um ambiente local determinístico;
3. implementar uma nova fonte sem acoplar regras de negócio à API externa;
4. garantir validação, deduplicação, idempotência e auditoria;
5. operar o sistema com Docker, PostgreSQL, n8n e Telegram;
6. diagnosticar falhas sem expor segredos;
7. adaptar o pipeline para outros tipos de automação.

## 2. Modelo mental: uma linha de produção confiável

Pense no sistema como uma linha de produção. Dados externos são matéria-prima. Adaptadores convertem formatos incompatíveis em um contrato comum. Regras de domínio descartam itens perigosos ou irrelevantes. Uma etapa humana decide casos sensíveis. O publicador entrega o resultado e registra evidências.

```mermaid
flowchart LR
    A["Agendador"] --> B["Coleta"]
    B --> C["Adaptador da fonte"]
    C --> D["Normalização"]
    D --> E["Validação"]
    E --> F["Scoring e deduplicação"]
    F --> G["Persistência"]
    G --> H["Fila ou aprovação humana"]
    H --> I["Revalidação"]
    I --> J["Roteamento"]
    J --> K["Publicação idempotente"]
    K --> L["Auditoria e observabilidade"]
```

O princípio mais importante é separar **orquestração** de **regra de negócio**:

- n8n agenda, encadeia chamadas e oferece visibilidade operacional;
- o Worker valida, decide, persiste e protege invariantes;
- PostgreSQL é a memória durável e a última barreira de consistência;
- Telegram é uma borda de interação, nunca a fonte única da verdade.

## 3. Pré-condições

### 3.1 Conhecimentos mínimos

Não é necessário dominar todas as tecnologias. É suficiente compreender:

- arquivo e diretório;
- variável de ambiente;
- requisição HTTP;
- tabela de banco de dados;
- comando executado no terminal.

### 3.2 Ferramentas

- Windows 10/11 ou Linux;
- Git;
- Docker Desktop com Compose v2;
- Node.js 22 para execução fora do container;
- uma conta Telegram e um bot criado no BotFather;
- credenciais oficiais das fontes que serão habilitadas.

### 3.3 Invariantes de segurança

Antes de qualquer comando, aceite estas regras:

1. `.env` nunca entra no Git;
2. tokens, cookies, refresh tokens e IDs administrativos não aparecem em documentação, commits ou logs compartilhados;
3. polling e webhook do Telegram não funcionam simultaneamente;
4. callbacks externos precisam de segredo e validação do administrador;
5. URLs externas são validadas antes de uso;
6. publicação exige imagem, estoque, link válido, validade e aprovação;
7. toda operação repetível possui chave de idempotência;
8. falha parcial deixa evidência recuperável.

## 4. Árvore de arquivos de referência

```text
freguesia/
├── apps/worker/                 API e regras de negócio
│   ├── src/domain/             Tipos e regras puras
│   ├── src/application/        Casos de uso
│   ├── src/adapters/           Telegram, fontes, banco e navegador
│   ├── src/http/               Rotas, schemas e autenticação
│   └── tests/                  Testes unitários e de integração
├── database/                   Schema e inicialização
├── n8n/workflows/              Workflows versionáveis
├── infra/                      Proxy reverso
├── scripts/                    Inicialização, backup e recuperação
├── docs/                       ADRs, runbooks e este manual
├── compose.yaml                Ambiente integrado
├── .env.example                Contrato de configuração sem segredos
└── context                     Estado operacional resumido
```

Critério de sucesso: cada pasta tem uma responsabilidade clara e dependências apontam para dentro. Domínio não importa Telegram, n8n ou PostgreSQL.

## 5. Componentes e contratos

### 5.1 Worker

O Worker é uma API interna. Ele recebe comandos, executa casos de uso e protege invariantes. Uma rota não deve conter a regra completa: valida entrada, chama uma função de aplicação e transforma o resultado em HTTP.

Contrato simplificado de um adaptador:

```ts
interface SourceAdapter {
  readonly source: string;
  discover(input: DiscoveryInput): Promise<DiscoveredProduct[]>;
  extract(input: { url: URL }): Promise<ExtractedProduct>;
  revalidate(product: ProductRef): Promise<PriceSnapshot>;
  createAffiliateLink(url: URL): Promise<AffiliateLinkResult>;
  healthCheck(): Promise<{ healthy: boolean; details: object }>;
}
```

Entradas e saídas devem ser dados simples. Nunca deixe um objeto específico do fornecedor atravessar para o domínio.

### 5.2 PostgreSQL

O banco armazena:

- fontes e produtos;
- observações imutáveis de preço;
- ofertas candidatas e seus estados;
- decisões humanas;
- publicações;
- eventos de auditoria;
- credenciais OAuth e estados PKCE;
- cartas mortas para falhas esgotadas.

Uma observação de preço é imutável. Uma oferta referencia a observação usada na decisão. Isso permite responder depois: “qual preço o sistema viu quando publicou?”.

### 5.3 n8n

n8n é o relógio e o painel de orquestração. Ele não deve decidir se desconto é válido, se o produto está duplicado ou se o usuário é administrador. Essas decisões pertencem ao Worker e ao banco.

Workflows principais:

- descoberta periódica;
- callback do Telegram, apenas no modo webhook;
- monitoramento de saúde;
- limpeza diária;
- workflows opcionais por fonte.

### 5.4 Telegram

Há três papéis diferentes:

- conversa privada com o bot para comandos administrativos;
- canal privado de aprovação;
- canais públicos de destino.

O callback deve validar, nesta ordem:

1. segredo de webhook, quando aplicável;
2. formato do payload;
3. ID do administrador;
4. ID do canal de aprovação;
5. ação permitida;
6. existência e estado da oferta;
7. idempotência da decisão.

### 5.5 Caddy

Caddy fornece HTTPS local para callbacks OAuth. O Worker continua protegido por token de serviço e exposto somente no loopback. HTTPS não substitui autenticação.

## 6. Preparação determinística

### Passo 1 — obter o código

```powershell
git clone <URL_DO_REPOSITORIO>
Set-Location freguesia
git status --short
```

Saída esperada: árvore limpa em uma branch conhecida.

### Passo 2 — criar configuração

```powershell
Copy-Item .env.example .env
```

Preencha `.env` localmente. Gere segredos com um gerador criptográfico. Não reutilize senha pessoal.

Campos mínimos:

```dotenv
APP_ENV=development
DATABASE_URL=postgresql://USUARIO:SENHA@postgres:5432/freguesia
WORKER_SERVICE_TOKEN=SEGREDO_LONGO_E_ALEATORIO
TELEGRAM_BOT_TOKEN=TOKEN_DO_BOTFATHER
TELEGRAM_APPROVAL_CHAT_ID=ID_PRIVADO
TELEGRAM_PUBLIC_CHANNEL_ID=ID_PUBLICO
TELEGRAM_ADMIN_USER_IDS=LISTA_DE_IDS
TELEGRAM_POLLING_ENABLED=true
```

Critério de sucesso: `.env` existe e `git check-ignore -v .env` confirma que está ignorado.

### Passo 3 — iniciar infraestrutura

```powershell
docker compose up -d --build
docker compose ps
```

Critério de sucesso: PostgreSQL, n8n e Worker ficam `healthy`; Caddy fica `Up`.

### Passo 4 — validar Worker

```powershell
Invoke-RestMethod http://127.0.0.1:3001/health
Invoke-RestMethod http://127.0.0.1:3001/ready
```

Saídas esperadas: `ok` e `ready`.

## 7. Banco de dados como máquina de estados

Estados típicos:

```mermaid
stateDiagram-v2
    [*] --> discovered
    discovered --> validated
    validated --> needs_affiliate_link
    validated --> pending_approval
    needs_affiliate_link --> pending_approval
    pending_approval --> approved
    pending_approval --> rejected
    pending_approval --> scheduled
    approved --> publishing
    scheduled --> publishing
    publishing --> published
    publishing --> failed
    discovered --> expired
    validated --> expired
    pending_approval --> expired
```

Invariantes recomendadas:

- transições inválidas retornam conflito;
- publicação nunca parte de `discovered`;
- item expirado não retorna ao fluxo sem nova observação;
- decisão humana é append-only;
- evento de auditoria registra ator, entidade, tipo e correlação;
- preço usa inteiro em centavos, nunca ponto flutuante financeiro.

## 8. Pipeline de coleta

### 8.1 Descoberta

Entrada:

```json
{
  "sourceSlug": "fonte",
  "query": "termo opcional",
  "category": "categoria opcional",
  "limit": 5,
  "correlationId": "UUID opcional"
}
```

Saída mínima:

```json
{
  "runId": "UUID",
  "discovered": 10,
  "created": 2,
  "ignored": 8,
  "failed": 0,
  "reasons": {}
}
```

O limite de entrada deve ter teto. O adaptador pode buscar um conjunto maior para curadoria, mas não deve criar volume ilimitado.

### 8.2 Extração e normalização

Normalize:

- título e identificador externo;
- URL canônica;
- preço atual e anterior em centavos;
- moeda;
- estoque;
- imagem principal e galeria;
- vendedor, reputação e volume de avaliações;
- cupom;
- origem do envio e impostos confirmados;
- parcelamento confirmado;
- data da captura;
- evidência bruta mínima para auditoria.

Não invente dados ausentes. “Não informado” é mais seguro do que uma estimativa apresentada como fato.

### 8.3 Validação

Uma validação robusta verifica:

- preço dentro de limites plausíveis;
- preço anterior maior que o atual;
- desconto mínimo e desconto anormal;
- estoque confirmado;
- idade da observação;
- imagem acessível com MIME permitido;
- URL afiliada HTTPS em domínio permitido;
- relevância da busca;
- política de fonte e termos de uso.

Saída recomendada:

```ts
type ValidationResult =
  | { valid: true; score: number; discountPercent: number | null }
  | { valid: false; reason: string; retryable: boolean };
```

### 8.4 Scoring

Scoring ordena itens válidos; não corrige item inválido. Exemplo:

```text
score = desconto + reputação + popularidade + envio_nacional + campanha
```

Trade-off: um score simples é explicável; um modelo estatístico pode ordenar melhor, mas exige dados, monitoramento de viés e versionamento.

### 8.5 Deduplicação

Use camadas:

1. chave natural `(fonte, external_id)`;
2. identificadores globais como EAN/GTIN/ISBN;
3. marca e modelo;
4. similaridade de título;
5. revisão humana para confiança intermediária.

Nunca una automaticamente dois produtos apenas porque os títulos são parecidos. Variação de tamanho, voltagem ou capacidade pode mudar preço e identidade.

## 9. Links afiliados e OAuth

### 9.1 Links

O fluxo seguro é:

```mermaid
sequenceDiagram
    participant W as Worker
    participant F as Fonte
    participant D as Banco
    W->>F: Solicita link oficial
    F-->>W: Link afiliado
    W->>W: Valida HTTPS e domínio
    W->>D: Persiste link e provedor
```

Nunca transforme uma URL arbitrária em botão antes de validar protocolo e hostname. Subdomínio deve ser comparado por fronteira: `host === permitido` ou `host.endsWith('.' + permitido)`.

### 9.2 OAuth 2.0 com PKCE

1. gere `state` e `code_verifier` aleatórios;
2. persista apenas hash do `state` e o verifier com expiração curta;
3. redirecione ao provedor;
4. no callback, consuma o estado uma única vez;
5. troque o código por tokens;
6. armazene tokens fora de logs;
7. renove perto da expiração;
8. substitua refresh token rotativo atomicamente.

Rotas de conectar e consultar status exigem token interno. Apenas o callback do provedor fica público, protegido por state e PKCE.

### 9.3 Automação assistida por navegador

Quando não existe API oficial de afiliado, use automação apenas se os termos permitirem. Não contorne CAPTCHA, MFA ou bloqueios. Sessões do navegador ficam em diretório ignorado e com acesso local restrito.

## 10. Aprovação humana

A mensagem de aprovação precisa mostrar informações suficientes para uma decisão:

- produto;
- preço e desconto;
- economia;
- cupom;
- loja;
- origem e impostos;
- parcelamento confirmado;
- canal de destino;
- imagem e link.

Cada botão leva um identificador curto, não dados sensíveis. O Worker resolve o ID, confirma que ele é único e registra a decisão com uma chave idempotente derivada do callback.

## 11. Rich Text, mídias e fallback

Estratégia:

1. uma imagem: bloco simples;
2. duas a dez mídias: slideshow;
3. Rich Text indisponível: `sendPhoto` com imagem principal;
4. legenda longa: truncar preservando rodapé e links essenciais;
5. falha de galeria não bloqueia a imagem principal válida.

Escape todo texto externo no modo HTML. Nunca misture Markdown legado com HTML sem normalização.

Cupons aparecem em parágrafo próprio. Impostos só aparecem como valor quando confirmados. Parcelamento “sem juros” só aparece se quantidade, parcela e taxa zero forem fornecidas pela plataforma.

## 12. Roteamento

Roteamento converte atributos do item em um destino. Ele deve ter fallback seguro.

```ts
type Route = {
  key: string;
  label: string;
  destinationId: string;
};
```

Alternativas:

- regras por palavras: simples, rápidas e explicáveis;
- taxonomia da fonte: precisa quando confiável, mas específica do fornecedor;
- classificador treinado: flexível, porém exige avaliação e fallback;
- tabela administrável: boa para operação sem deploy.

## 13. Publicação idempotente

Antes de enviar:

1. confirme estado `approved` ou `scheduled`;
2. confirme imagem, link, estoque e validade;
3. confirme melhor promoção;
4. confirme ausência de publicação diária do produto;
5. aplique limites por hora, dia e intervalo mínimo;
6. consulte chave de idempotência.

Depois de enviar:

1. registre publicação e ID da mensagem;
2. marque oferta como publicada;
3. registre evento de auditoria;
4. remova mensagem de aprovação apenas após sucesso.

Limitação distribuída: existe uma janela entre enviar ao Telegram e registrar no banco. Em escala maior, use outbox transacional, fila com consumidor único ou uma reserva `publishing` com lease e reconciliação.

## 14. Agendamento e filas

n8n é adequado para baixo volume e operação visual. Para maior escala, introduza uma fila.

```mermaid
flowchart LR
    A["n8n"] --> B["API de comando"]
    B --> C["Outbox no PostgreSQL"]
    C --> D["Fila"]
    D --> E["Consumidor"]
    E --> F["Fonte ou Telegram"]
    E --> G["Retry"]
    G --> H["Dead letter"]
```

Uma mensagem de fila contém ID e correlação, não o objeto inteiro. O consumidor recarrega o estado atual do banco.

## 15. Observabilidade e auditoria

Registre logs estruturados com:

- `correlationId`;
- `runId`;
- `offerId`;
- fonte;
- etapa;
- duração;
- resultado e erro sanitizado.

Nunca registre headers completos, bodies de OAuth, cookies, tokens ou `.env`.

Métricas úteis:

- candidatos coletados por fonte;
- taxa de descarte por motivo;
- tempo por etapa;
- aprovações e rejeições;
- falhas de publicação;
- idade da fila;
- circuit breaker aberto;
- expiração de credenciais;
- publicações por canal.

## 16. Segurança em profundidade

Checklist:

- Worker limitado ao loopback no host;
- rede interna do Compose;
- token interno longo;
- comparação de segredo em tempo constante;
- webhook Telegram com secret token;
- allowlist de administradores e canal;
- CORS fechado por padrão;
- container sem root e `no-new-privileges`;
- imagens oficiais fixadas por versão;
- credenciais fora do Git;
- URLs e tamanhos validados;
- queries parametrizadas;
- OAuth state de uso único;
- backup criptografado e restauração testada;
- atualização periódica de dependências.

## 17. Testes

### 17.1 Pirâmide

- unitários: preço, URL, scoring, classificação e legenda;
- integração: adaptador com HTTP simulado e repositório com banco;
- contrato: schemas de entrada e saída;
- ponta a ponta controlado: criar, aprovar e publicar em canal de teste;
- recuperação: simular indisponibilidade e repetir com mesma idempotência.

### 17.2 Comandos verificáveis

```powershell
Set-Location apps/worker
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npm run format:check

Set-Location ../../packages/product-matching
npm ci
npm test
npm run build
```

### 17.3 Testes de aceitação

1. Oferta sem imagem é rejeitada antes da aprovação.
2. URL afiliada fora da allowlist é rejeitada.
3. Callback com usuário falso não muda estado.
4. Callback de outro canal não muda estado.
5. Repetir a mesma chave não cria segunda publicação.
6. Produto já publicado no dia é bloqueado.
7. Oferta expirada é bloqueada.
8. Falha do Rich Text usa foto comum.
9. Falha de fonte respeita retry e circuit breaker.
10. Reinício preserva produtos, decisões e publicações.

## 18. Docker e produção

O build usa múltiplos estágios: dependências de desenvolvimento e compilação ficam no builder; a imagem final recebe apenas dependências de produção, runtime e artefatos compilados. O processo final roda como usuário sem privilégios.

Antes de atualizar:

```powershell
docker compose config --quiet
docker compose build worker
docker compose up -d
docker compose ps
```

Não publique portas do PostgreSQL ou n8n sem necessidade. Em produção, use domínio real, TLS público, firewall e armazenamento de segredos apropriado.

## 19. Inicialização automática no Windows

O padrão local usa um atalho na pasta Startup chamando `scripts/start-freguesia.ps1`.

O script deve:

1. testar se o engine Docker responde;
2. iniciar Docker Desktop se necessário;
3. aguardar com prazo máximo;
4. entrar no diretório absoluto do projeto;
5. executar `docker compose up -d`;
6. registrar sucesso ou erro sem segredos;
7. retornar código de saída correto.

Uma tarefa separada processa a fila assistida do Mercado Livre. Configure “não iniciar nova instância” para impedir navegadores concorrentes.

Validação:

```powershell
Get-ScheduledTask -TaskName 'Freguesia Mercado Livre Affiliate Queue'
Get-ScheduledTaskInfo -TaskName 'Freguesia Mercado Livre Affiliate Queue'
docker compose ps
```

## 20. Backup, recuperação e manutenção

### Backup

- dump lógico do banco;
- exportação dos workflows;
- cópia controlada dos volumes necessários;
- registro da versão do código e das imagens;
- nunca incluir `.env` em backup não criptografado.

### Recuperação

1. pare produtores e agendamentos;
2. restaure banco em instância isolada;
3. valide contagens e constraints;
4. restaure workflows desativados;
5. suba Worker e execute `/ready`;
6. faça teste em canal de homologação;
7. ative agendamentos gradualmente;
8. reconcilie ofertas em `publishing` ou `failed`.

### Limpeza

Pode remover estados OAuth expirados, traces e screenshots temporários. Não remova publicações, eventos de auditoria ou histórico de preço sem política formal de retenção.

## 21. Solução de problemas

### Worker não fica pronto

- confira `docker compose ps`;
- veja apenas logs necessários e sanitize antes de compartilhar;
- confirme host `postgres` na URL interna;
- confirme schema/migrações;
- teste conectividade dentro da rede do Compose.

### Bot não recebe botões

- confirme se polling ou webhook está habilitado, nunca ambos;
- no polling, confira conflito 409 de outra instância;
- no webhook, confira HTTPS e secret token;
- confirme administrador e canal de aprovação;
- confirme permissões do bot.

### Fonte retorna muitos erros

- valide credencial sem imprimi-la;
- confira status oficial e rate limit;
- reduza concorrência;
- respeite `Retry-After`;
- abra circuit breaker e alerte operador;
- não substitua API oficial por scraping oculto.

### Publicação duplicada

- procure mesma chave idempotente;
- confira publicação diária por produto;
- confira consumidores concorrentes;
- reconcilie mensagem no Telegram com tabela `publications`;
- em escala, adote outbox e lease de publicação.

## 22. Adaptação para outros domínios

| Domínio | Item coletado | Validação | Aprovação | Publicação |
|---|---|---|---|---|
| Monitoramento de preços | preço por produto | variação plausível | alerta extremo | dashboard/Telegram |
| Curadoria de notícias | artigo | fonte, data, duplicidade | editor | canal/site |
| Alertas operacionais | evento | severidade e ruído | plantonista | pager/chat |
| Atendimento | mensagem | intenção e política | agente humano | resposta |
| Moderação | conteúdo | regras e confiança | moderador | manter/remover |
| ETL | registro | schema e qualidade | steward | warehouse |
| Marketplaces | anúncio | estoque, preço, identidade | operador | catálogo |
| Geração de conteúdo | rascunho | fatos, marca, segurança | editor | CMS/social |

O que muda são contratos de domínio e destinos. Permanecem coleta, normalização, validação, idempotência, auditoria, observabilidade e recuperação.

## 23. Substituição de componentes

- n8n → Temporal, Airflow, Dagster, cron ou scheduler gerenciado;
- PostgreSQL → outro banco transacional, preservando constraints;
- Telegram → Slack, Teams, e-mail, painel web ou aplicativo móvel;
- Docker Compose → Kubernetes, ECS ou serviço de containers;
- polling → webhook, quando houver endpoint público seguro;
- regras de classificação → tabela, motor de regras ou modelo;
- fila local → RabbitMQ, SQS, Pub/Sub, Kafka ou Redis Streams.

Decisão: substitua um componente por vez e mantenha o contrato. Execute testes de aceitação antes e depois.

## 24. Pontos de extensão

Para adicionar uma fonte:

1. documente API, limites e termos;
2. crie variáveis vazias em `.env.example`;
3. implemente `SourceAdapter`;
4. normalize para `ExtractedProduct`;
5. valide links e mídias;
6. adicione caso de uso de descoberta;
7. registre rota e workflow inativo;
8. crie testes com fixtures sem credenciais;
9. habilite somente após teste controlado.

Para adicionar destino:

1. configure ID por ambiente;
2. adicione regra de roteamento e fallback;
3. valide permissão do bot;
4. teste em homologação;
5. registre canal usado na publicação.

## 25. Como uma IA pode replicar esta arquitetura

### Roteiro operacional

1. Leia integralmente `context`, README, schema, Compose e contratos.
2. Execute `git status` e preserve alterações preexistentes.
3. Não leia nem imprima `.env`; consulte apenas nomes em `.env.example`.
4. Desenhe o fluxo real a partir de imports, rotas, SQL e workflows.
5. Liste invariantes e associe cada uma a código, banco e teste.
6. Execute a linha de base antes de editar.
7. Priorize segurança, perda de dados, duplicação e estados impossíveis.
8. Faça patches pequenos e reversíveis.
9. Adicione teste que falha antes ou cobre a correção.
10. Rode teste, lint, typecheck, build e validação do Compose.
11. Revise diff procurando segredos, arquivos binários e mudanças acidentais.
12. Atualize documentação e `context` com fatos confirmados.
13. Crie commit sem amend e envie sem force push.

### Limites de segurança para a IA

- não revelar valores sensíveis em resposta ou ferramenta;
- não apagar volumes, banco, branches ou sessões;
- não ativar integração externa sem credencial e autorização;
- não contornar CAPTCHA, MFA ou termos de uso;
- não publicar conteúdo real durante teste sem consentimento;
- não assumir que workflow versionado é a versão ativa;
- não declarar sucesso sem comando verificável;
- interromper se surgirem alterações inesperadas durante a execução.

### Checklist de validação da IA

- [ ] contexto lido por completo;
- [ ] árvore e Git inventariados;
- [ ] segredos ignorados;
- [ ] autenticação e callbacks revisados;
- [ ] SQL parametrizado;
- [ ] estados e idempotência revisados;
- [ ] workflows validados;
- [ ] Docker validado;
- [ ] banco migrado sem operação destrutiva;
- [ ] testes completos aprovados;
- [ ] manual e contexto atualizados;
- [ ] diff revisado;
- [ ] commit e push relatados.

## 26. Checklist final de implantação

- [ ] Docker e Node em versões suportadas;
- [ ] `.env` ignorado e preenchido localmente;
- [ ] senhas padrão substituídas;
- [ ] banco saudável e migrado;
- [ ] Worker `ready`;
- [ ] n8n acessível apenas como planejado;
- [ ] polling/webhook mutuamente exclusivos;
- [ ] secret token do webhook configurado;
- [ ] bot administrador nos canais corretos;
- [ ] fontes habilitadas uma por vez;
- [ ] links afiliados validados;
- [ ] mídias e fallback testados;
- [ ] limites de publicação ativos;
- [ ] backup e restauração testados;
- [ ] alertas operacionais configurados;
- [ ] teste ponta a ponta em destino seguro concluído.

## 27. Critério de conclusão

A arquitetura está replicada quando uma entrada controlada percorre coleta, normalização, validação, persistência, aprovação e publicação; a repetição da mesma entrada não duplica efeitos; uma falha deixa auditoria; o reinício preserva estado; e nenhuma credencial aparece no repositório ou nos logs compartilháveis.
