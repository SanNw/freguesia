# ADR-001 — Arquitetura: n8n + Worker TypeScript separado

**Status:** Aceito  
**Data:** 15 de agosto de 2026

## Contexto

A Freguesia precisa orquestrar descoberta, validação, aprovação humana e publicação de ofertas em horários definidos, com retentativas, auditoria e observabilidade.

## Decisão

Separar responsabilidades entre:

- **n8n** como orquestrador visual (agendamento, fan-out/fan-in, chamadas HTTP, aprovação via Telegram, retries de workflow, alertas).
- **Freguesia Worker** (Node.js + TypeScript + Fastify + Playwright) como executor de lógica de domínio (adaptadores de fonte, extração, normalização, validação, persistência transacional, idempotência, health/readiness).
- **PostgreSQL** como fonte de verdade (ofertas, histórico de preços, auditoria, idempotência).

## Justificativa

1. **n8n não é banco de dados.** Lógica crítica em Code nodes sem testes é frágil e não versionável de forma segura.
2. **Playwright isolado.** O navegador é um adaptador de último recurso. Manter em serviço separado facilita timeouts, concorrência, segurança e testes.
3. **Domínio independente.** O TypeScript permite contratos com Zod, testes unitários, type checking estrito e funções puras.
4. **PostgreSQL como fonte de verdade.** Idempotência, auditoria e histórico de preços não podem depender do estado do n8n.
5. **Aprovação humana no MVP.** O Telegram pública botões inline; o Worker valida actor e registra decisão.

## Alternativas Consideradas

- **Tudo no n8n:** Rejeitado. Código complexo em Code nodes é difícil de testar e manter. Risco de duplicação de lógica.
- **Tudo no Worker (cron interno):** Rejeitado. n8n oferece orquestração visual, retries, aprovadores e operação acessível.
- **MCP como motor:** Adiado para Fase 6. MCP é opcional como interface de comando para IA, mas não motor de execução 24/7.

## Consequências

- Dois processos para operar (n8n + Worker), mas ambas em um único Docker Compose.
- O Worker expõe uma API HTTP interna estável com autenticação por Bearer token.
- Workflows n8n são exportados como JSON e versionados.
- O domínio não depende de Playwright, Fastify ou n8n.
