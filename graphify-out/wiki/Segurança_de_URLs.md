# Segurança de URLs

> 7 nodes

## Key Concepts

- **url.ts** (7 connections) — `apps/worker/src/shared/url.ts`
- **validateExternalUrl()** (6 connections) — `apps/worker/src/shared/url.ts`
- **url.test.ts** (5 connections) — `apps/worker/tests/unit/url.test.ts`
- **isAllowedDomain()** (3 connections) — `apps/worker/src/shared/url.ts`
- **isPrivateOrLoopback()** (3 connections) — `apps/worker/src/shared/url.ts`
- **normalizeUrl()** (2 connections) — `apps/worker/src/shared/url.ts`
- **PRIVATE_IP_PATTERNS** (1 connections) — `apps/worker/src/shared/url.ts`

## Relationships

- [Adaptadores de Ofertas](Adaptadores_de_Ofertas.md) (3 shared connections)

## Source Files

- `apps/worker/src/shared/url.ts`
- `apps/worker/tests/unit/url.test.ts`

## Audit Trail

- EXTRACTED: 15 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*