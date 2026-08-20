# Freguesia

Plataforma de curadoria e publicação de ofertas com n8n, Worker TypeScript/Playwright, PostgreSQL e Telegram.

## Arquitetura

```
n8n (orquestra) → Worker Node.js/TS/Playwright (executa) → PostgreSQL (fonte de verdade)
                                                          Telegram (aprovação + publicação)
```

- **n8n** coordena horários, etapas, retries, aprovação humana e publicação.
- **Freguesia Worker** executa navegação, normaliza produtos, manipula sessões e expõe API interna.
- **PostgreSQL** mantém ofertas, histórico de preços, auditoria e idempotência.
- **Telegram Bot API** recebe aprovações e publica no canal.

## Manual completo

Para aprender a arquitetura do zero, recriar o projeto ou adaptá-lo para outros tipos de automação, consulte o [Manual de Arquitetura Replicável](./docs/MANUAL-ARQUITETURA-REPLICAVEL.md).

O manual aborda Worker, PostgreSQL, n8n, Telegram, Docker, fontes de dados, OAuth, afiliados, classificação, aprovação humana, publicação, segurança, testes, observabilidade, recuperação e replicação por pessoas ou agentes de IA.

## Pré-requisitos

- Docker e Docker Compose
- Node.js 22+ (para desenvolvimento local do Worker)
- Um bot do Telegram criado via `@BotFather`
- Um canal privado de aprovação e um canal público

## Início rápido

```bash
# 1. Clonar
git clone git@github.com:SanNw/freguesia.git
cd freguesia

# 2. Copiar variáveis de ambiente
cp .env.example .env
# Editar .env com valores reais

# 3. Subir infraestrutura (PostgreSQL + n8n + Worker + Caddy)
docker compose up -d

# 4. Aplicar migrations
docker compose exec worker npm run db:migrate

# 5. Acessar n8n
# http://localhost:5678 (desenvolvimento)
```

## Desenvolvimento do Worker

```bash
cd apps/worker
npm install
npm run dev          # servidor em modo watch
npm run test         # testes unitários
npm run test:e2e     # testes E2E
npm run lint
npm run typecheck
```

## Estrutura do repositório

Ver [Freguesia.md](./Freguesia.md) para a especificação técnica completa.

## Mapa interativo do projeto

Explore a [árvore de arquivos e relações](https://sannw.github.io/freguesia/) gerada pelo Graphify. O mapa ajuda pessoas e agentes de IA a navegar pela estrutura do projeto sem precisar ler todo o repositório.

- [Abrir árvore interativa](https://sannw.github.io/freguesia/)
- [Abrir grafo completo](https://sannw.github.io/freguesia/graph.html)
- [Consultar relatório do grafo](./graphify-out/GRAPH_REPORT.md)

## Documentação

- [Manual de Arquitetura Replicável](./docs/MANUAL-ARQUITETURA-REPLICAVEL.md)
- [Especificação técnica](./Freguesia.md)
- [ADRs](./docs/adr/)
- [Security](./docs/SECURITY.md)
- [Data Retention](./docs/DATA_RETENTION.md)
- [Runbooks](./docs/runbooks/)

## Licença

MIT
