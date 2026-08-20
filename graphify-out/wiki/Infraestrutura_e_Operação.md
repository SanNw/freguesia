# Infraestrutura e Operação

> 42 nodes

## Key Concepts

- **Freguesia Worker domain and browser automation service** (11 connections) — `Freguesia.md`
- **Freguesia offer curation and publication platform** (7 connections) — `Freguesia.md`
- **PostgreSQL source of truth** (6 connections) — `Freguesia.md`
- **Freguesia threat model and security controls** (6 connections) — `docs/SECURITY.md`
- **Docker Compose runtime stack** (5 connections) — `compose.yaml`
- **Telegram human approval and publication interface** (5 connections) — `Freguesia.md`
- **n8n orchestration layer** (4 connections) — `Freguesia.md`
- **Affiliate platform integration guide** (4 connections) — `Integração de plataformas.md`
- **Decision to separate n8n, Worker, and PostgreSQL responsibilities** (4 connections) — `docs/adr/ADR-001-n8n-worker-separado.md`
- **Worker tests, workflow validation, and Compose validation** (3 connections) — `.github/workflows/ci.yml`
- **Pinned dependencies and CI security scanning** (3 connections) — `docs/SECURITY.md`
- **Idempotent offer publication** (3 connections) — `Freguesia.md`
- **Discover, approve, callback, publish, monitor, and cleanup workflows** (3 connections) — `n8n/README.md`
- **Telegram publication failure investigation and recovery** (3 connections) — `docs/runbooks/publication-failure.md`
- **Worker container build and Trivy image scan** (2 connections) — `.github/workflows/docker-build.yml`
- **Scheduled npm dependency security audit** (2 connections) — `.github/workflows/security.yml`
- **Unified normalized affiliate offer contract** (2 connections) — `Integração de plataformas.md`
- **Cross-store product identity matching** (2 connections) — `Integração de plataformas.md`
- **Total known cost comparison with confidence scoring** (2 connections) — `Integração de plataformas.md`
- **Data retention and deletion policy** (2 connections) — `docs/DATA_RETENTION.md`
- **Replicable architecture and operations manual** (2 connections) — `docs/MANUAL-ARQUITETURA-REPLICAVEL.md`
- **Source adapter failure investigation and recovery** (2 connections) — `docs/runbooks/source-failure.md`
- **Source registry and enablement process** (2 connections) — `docs/sources/README.md`
- **Pull request architecture, security, data, and quality gate** (2 connections) — `.github/pull_request_template.md`
- **Version-controlled n8n workflow catalog** (2 connections) — `n8n/README.md`
- *... and 17 more nodes in this community*

## Relationships

- No strong cross-community connections detected

## Source Files

- `.github/dependabot.yml`
- `.github/pull_request_template.md`
- `.github/workflows/ci.yml`
- `.github/workflows/docker-build.yml`
- `.github/workflows/security.yml`
- `AGENTS.md`
- `Freguesia.md`
- `Integração de plataformas.md`
- `README.md`
- `SECURITY.md`
- `compose.yaml`
- `docs/DATA_RETENTION.md`
- `docs/MANUAL-ARQUITETURA-REPLICAVEL.md`
- `docs/SECURITY.md`
- `docs/adr/ADR-001-n8n-worker-separado.md`
- `docs/runbooks/publication-failure.md`
- `docs/runbooks/source-failure.md`
- `docs/sources/README.md`
- `infra/compose.override.yaml`
- `n8n/README.md`

## Audit Trail

- EXTRACTED: 45 (83%)
- INFERRED: 9 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*